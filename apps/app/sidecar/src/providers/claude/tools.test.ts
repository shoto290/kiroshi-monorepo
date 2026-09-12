import { describe, expect, it } from "bun:test"

import { claudeSourceExecutable } from "./build"
import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { CONNECTION_KEYS } from "./session-env"
import { builtInTools, toolsOptions } from "./tools"

process.env[EXECUTABLE_OVERRIDE_ENV] = claudeSourceExecutable()

describe("toolsOptions", () => {
	it("spawns the binary with the held source", () => {
		const env = toolsOptions({ CLAUDE_CODE_OAUTH_TOKEN: "held-token" }).env

		expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("held-token")
	})

	it("spawns the binary with neither name while no source is held", () => {
		const env = toolsOptions().env

		for (const key of CONNECTION_KEYS) {
			expect(env).not.toHaveProperty(key)
		}
	})
})

describe("builtInTools", () => {
	it("keeps the install's own tools, in the order the session named them", () => {
		expect(builtInTools(["Task", "Bash", "Read", "Write"])).toEqual([
			"Task",
			"Bash",
			"Read",
			"Write",
		])
	})

	it("leaves out every tool an MCP server provides", () => {
		expect(
			builtInTools([
				"Bash",
				"mcp__context7__query-docs",
				"Read",
				"mcp__plugin_helper__write_html",
			]),
		).toEqual(["Bash", "Read"])
	})

	it("answers nothing for a session that named nothing", () => {
		expect(builtInTools([])).toEqual([])
	})
})
