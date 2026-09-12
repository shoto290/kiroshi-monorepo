import { describe, expect, it } from "bun:test"

import { claudeSourceExecutable } from "./build"
import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { modelsOptions } from "./models"
import { CONNECTION_KEYS } from "./session-env"

process.env[EXECUTABLE_OVERRIDE_ENV] = claudeSourceExecutable()

describe("modelsOptions", () => {
	it("spawns the binary with the held source", () => {
		const env = modelsOptions({ ANTHROPIC_API_KEY: "sk-held" }).env

		expect(env.ANTHROPIC_API_KEY).toBe("sk-held")
	})

	it("spawns the binary with neither name while no source is held", () => {
		const env = modelsOptions().env

		for (const key of CONNECTION_KEYS) {
			expect(env).not.toHaveProperty(key)
		}
	})
})
