import { describe, expect, it } from "bun:test"

import { claudeSourceExecutable } from "./build"
import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import { modelsOptions, offeredModels } from "./models"
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

const valuesOf = (offered: { value: string }[]) =>
	offered.map((model) => model.value)

describe("offeredModels", () => {
	it("drops default and keeps the other values in their order", () => {
		const offered = [
			{ value: "opus" },
			{ value: "default" },
			{ value: "sonnet" },
			{ value: "haiku" },
		]

		expect(valuesOf(offeredModels(offered))).toEqual([
			"opus",
			"sonnet",
			"haiku",
		])
	})

	it("returns every value while default is not offered", () => {
		expect(
			valuesOf(offeredModels([{ value: "sonnet" }, { value: "opus" }])),
		).toEqual(["sonnet", "opus"])
	})

	it("carries the effort levels of a model that supports effort", () => {
		expect(
			offeredModels([
				{
					value: "opus",
					supportsEffort: true,
					supportedEffortLevels: ["low", "high", "max"],
				},
			]),
		).toEqual([
			{ value: "opus", supportedEffortLevels: ["low", "high", "max"] },
		])
	})

	it("offers no level for a model whose effort support is off or unsaid", () => {
		expect(
			offeredModels([
				{
					value: "haiku",
					supportsEffort: false,
					supportedEffortLevels: ["low"],
				},
				{ value: "sonnet", supportedEffortLevels: ["high"] },
				{ value: "fable", supportsEffort: true },
			]),
		).toEqual([
			{ value: "haiku", supportedEffortLevels: [] },
			{ value: "sonnet", supportedEffortLevels: [] },
			{ value: "fable", supportedEffortLevels: [] },
		])
	})
})
