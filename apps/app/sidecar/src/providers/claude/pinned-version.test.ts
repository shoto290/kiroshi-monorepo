import { describe, expect, test } from "bun:test"

import { assertPinnedVersion } from "./pinned-version"

describe("assertPinnedVersion", () => {
	test("passes when the resolved version matches the pin", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.1.280" }),
		).not.toThrow()
	})

	test("fails naming both versions and bun install when they differ", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.1.257" }),
		).toThrow(
			"@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code 2.1.257, but apps/app/sidecar/package.json pins 2.1.280. Run bun install to resolve the pinned version.",
		)
	})
})
