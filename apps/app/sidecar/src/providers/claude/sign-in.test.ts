import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { pointAtFakeExecutable, recordedEnv } from "./fake-executable"
import { inheritedEnv } from "./session-env"
import {
	cancelClaudeSignIn,
	enterClaudeSignInCode,
	SIGN_IN_STARTED,
	SIGN_IN_TIMEOUT_MS,
	signInClaude,
} from "./sign-in"

import type { SessionFrame, SignInAnswer } from "../provider"

const OFFERED_URL = "https://claude.test/oauth/authorize?code=true&state=abc"
const PASTED_CODE = "the-pasted-code"
const OUTSIDE_KEY = "KIROSHI_SIGN_IN_OUTSIDE"
const CONFIG_DIR_KEY = "CLAUDE_CONFIG_DIR"
const POLL_MS = 10
const SHORT_BOUND_MS = 300

const OFFER = [
	"printf 'Opening browser to sign in…\\n'",
	`printf 'If the browser didn'"'"'t open, visit: \\033]8;;${OFFERED_URL}\\007${OFFERED_URL}\\033]8;;\\007\\n'`,
	"printf 'Paste code here if prompted > '",
].join("\n")

const HANGING = `${OFFER}\nexec sleep 30`

let directory: string
let frames: SessionFrame[]
let inFlight: Promise<SignInAnswer> | undefined
const heldOverride = process.env[EXECUTABLE_OVERRIDE_ENV]

const collect = (frame: SessionFrame) => {
	frames.push(frame)
}

const recorded = (name: string) => join(directory, name)

const aSignIn = (timeoutMs?: number) => {
	inFlight = signInClaude(collect, timeoutMs)
	return inFlight
}

const untilStarted = async () => {
	while (frames.length === 0) {
		await Bun.sleep(POLL_MS)
	}
}

const restore = (key: string, value: string | undefined) => {
	if (value === undefined) {
		delete process.env[key]
		return
	}
	process.env[key] = value
}

describe("sign in with claude", () => {
	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "kiroshi-sign-in-"))
		frames = []
	})

	afterEach(async () => {
		cancelClaudeSignIn()
		await inFlight
		inFlight = undefined
		restore(EXECUTABLE_OVERRIDE_ENV, heldOverride)
		rmSync(directory, { recursive: true, force: true })
	})

	it("announces the offered url, takes the pasted code on stdin and answers signed in", async () => {
		pointAtFakeExecutable(
			directory,
			[
				OFFER,
				"read code",
				`printf '%s' "$code" > '${recorded("code")}'`,
				"echo 'Login successful.'",
			].join("\n"),
		)

		const flow = aSignIn()
		await untilStarted()
		enterClaudeSignInCode(PASTED_CODE)

		expect(await flow).toEqual({ signedIn: true })
		expect(frames).toEqual([{ type: SIGN_IN_STARTED, url: OFFERED_URL }])
		expect(readFileSync(recorded("code"), "utf8")).toBe(PASTED_CODE)
	})

	it("answers failed with the reason the line reporting the failed login gave", async () => {
		pointAtFakeExecutable(
			directory,
			`${OFFER}\necho 'Login failed: the code was refused' >&2\nexit 1`,
		)

		expect(await aSignIn()).toEqual({
			signedIn: false,
			error: { kind: "failed", detail: "the code was refused" },
		})
	})

	it("answers failed with the exit status when no line reported the failure", async () => {
		pointAtFakeExecutable(directory, `${OFFER}\nexit 3`)

		expect(await aSignIn()).toEqual({
			signedIn: false,
			error: { kind: "failed", detail: "the sign-in exited with status 3" },
		})
	})

	it("kills the child and answers cancelled on a cancel", async () => {
		pointAtFakeExecutable(directory, HANGING)

		const flow = aSignIn()
		await untilStarted()
		cancelClaudeSignIn()

		expect(await flow).toEqual({
			signedIn: false,
			error: { kind: "cancelled" },
		})
	})

	it("answers a second sign-in busy and leaves the running one alone", async () => {
		pointAtFakeExecutable(directory, HANGING)

		const flow = aSignIn()
		await untilStarted()
		const second = await signInClaude(collect)
		const firstBeforeCancel = await Promise.race([
			flow,
			Bun.sleep(SHORT_BOUND_MS).then(() => "running"),
		])
		cancelClaudeSignIn()

		expect(second).toMatchObject({ signedIn: false, error: { kind: "busy" } })
		expect(firstBeforeCancel).toBe("running")
		expect(await flow).toMatchObject({ error: { kind: "cancelled" } })
	})

	it("bounds the sign-in at 300000 ms", () => {
		expect(SIGN_IN_TIMEOUT_MS).toBe(300_000)
	})

	it("kills a child that outlasts the bound and answers timed out", async () => {
		pointAtFakeExecutable(directory, HANGING)

		expect(await aSignIn(SHORT_BOUND_MS)).toEqual({
			signedIn: false,
			error: { kind: "timedOut" },
		})
	})

	it("spawns auth login with the inherited environment and nothing else", async () => {
		const heldConfigDir = process.env[CONFIG_DIR_KEY]
		process.env[CONFIG_DIR_KEY] = directory
		process.env[OUTSIDE_KEY] = "outside"
		pointAtFakeExecutable(
			directory,
			`printf '%s\\n' "$@" > '${recorded("args")}'\nenv > '${recorded("env")}'`,
		)

		try {
			expect(await aSignIn()).toEqual({ signedIn: true })
			expect(readFileSync(recorded("args"), "utf8")).toBe("auth\nlogin\n")
			expect(recordedEnv(recorded("env"))).toEqual(inheritedEnv())
		} finally {
			restore(CONFIG_DIR_KEY, heldConfigDir)
			delete process.env[OUTSIDE_KEY]
		}
	})
})
