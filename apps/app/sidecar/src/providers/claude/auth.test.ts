import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { authenticateClaude } from "./auth"
import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { pointAtFakeExecutable, recordedEnv } from "./fake-executable"
import { CONNECTION_KEYS, sessionEnv } from "./session-env"

const CONFIG_DIR_KEY = "CLAUDE_CONFIG_DIR"

const SIGNED_IN = {
	loggedIn: true,
	authMethod: "claude.ai",
	email: "bean@example.test",
	orgId: "org-1",
	orgName: "Bean Org",
	subscriptionType: "max",
}

const SIGNED_OUT = { loggedIn: false, authMethod: "none" }

let directory: string
const heldOverride = process.env[EXECUTABLE_OVERRIDE_ENV]
const heldConfigDir = process.env[CONFIG_DIR_KEY]

const restore = (key: string, value: string | undefined) => {
	if (value === undefined) {
		delete process.env[key]
		return
	}
	process.env[key] = value
}

const answering = (status: object, script = "") =>
	pointAtFakeExecutable(
		directory,
		`${script}\nprintf '%s' '${JSON.stringify(status)}'`,
	)

describe("authenticateClaude", () => {
	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "kiroshi-auth-"))
	})

	afterEach(() => {
		restore(EXECUTABLE_OVERRIDE_ENV, heldOverride)
		restore(CONFIG_DIR_KEY, heldConfigDir)
		rmSync(directory, { recursive: true, force: true })
	})

	it("reads the account from the email and the subscription type of the status", async () => {
		answering(SIGNED_IN)

		expect(await authenticateClaude()).toEqual({
			authenticated: true,
			authMethod: "claude.ai",
			account: { email: "bean@example.test", plan: "max" },
		})
	})

	it("names no account when the status names neither an email nor a plan", async () => {
		answering(SIGNED_OUT)

		const auth = await authenticateClaude()

		expect(auth.authenticated).toBe(false)
		expect(auth.account).toBeUndefined()
	})

	it("spawns the probe with the environment a session gets, the config dir among it", async () => {
		process.env[CONFIG_DIR_KEY] = directory
		const envPath = join(directory, "env")
		answering(SIGNED_OUT, `env > '${envPath}'`)

		await authenticateClaude()

		expect(recordedEnv(envPath)).toEqual(sessionEnv())
		expect(recordedEnv(envPath)[CONFIG_DIR_KEY]).toBe(directory)
	})

	it("spawns the probe with the held source and nothing else of the sidecar", async () => {
		process.env.KIROSHI_SECRET_TOKEN = "leaked"
		process.env.ANTHROPIC_API_KEY = "sk-host"
		const connection = { CLAUDE_CODE_OAUTH_TOKEN: "held-token" }
		const envPath = join(directory, "env")
		answering(SIGNED_OUT, `env > '${envPath}'`)

		await authenticateClaude(connection)

		const seen = recordedEnv(envPath)
		delete process.env.KIROSHI_SECRET_TOKEN
		delete process.env.ANTHROPIC_API_KEY
		expect(seen).toEqual(sessionEnv(connection))
		expect(seen.CLAUDE_CODE_OAUTH_TOKEN).toBe("held-token")
		expect(seen).not.toHaveProperty("KIROSHI_SECRET_TOKEN")
		expect(seen).not.toHaveProperty("ANTHROPIC_API_KEY")
	})

	it("spawns the probe with neither name while no source is held", async () => {
		const envPath = join(directory, "env")
		answering(SIGNED_OUT, `env > '${envPath}'`)

		await authenticateClaude()

		for (const key of CONNECTION_KEYS) {
			expect(recordedEnv(envPath)).not.toHaveProperty(key)
		}
	})

	it("carries the method the status names unchanged", async () => {
		answering(SIGNED_IN)

		const auth = await authenticateClaude({ ANTHROPIC_API_KEY: "sk-held" })

		expect(auth.authMethod).toBe("claude.ai")
	})

	it("leaves the method absent when the status names none", async () => {
		answering({ loggedIn: true })

		const auth = await authenticateClaude()

		expect(auth).not.toHaveProperty("authMethod")
	})
})
