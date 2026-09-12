import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { authenticateClaude } from "./auth"
import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { pointAtFakeExecutable, recordedEnv } from "./fake-executable"
import { inheritedEnv } from "./session-env"

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
			account: { email: "bean@example.test", plan: "max" },
		})
	})

	it("names no account when the status names neither an email nor a plan", async () => {
		answering(SIGNED_OUT)

		const auth = await authenticateClaude()

		expect(auth.authenticated).toBe(false)
		expect(auth.account).toBeUndefined()
	})

	it("spawns the probe with the inherited environment and no config dir", async () => {
		process.env[CONFIG_DIR_KEY] = directory
		const envPath = join(directory, "env")
		answering(SIGNED_OUT, `env > '${envPath}'`)

		await authenticateClaude()

		expect(recordedEnv(envPath)).toEqual(inheritedEnv())
		expect(recordedEnv(envPath)).not.toHaveProperty(CONFIG_DIR_KEY)
	})
})
