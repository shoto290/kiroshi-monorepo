import { describe, expect, test } from "bun:test"

import { assertPinnedVersion, readPinnedVersion } from "./pinned-version"

describe("assertPinnedVersion", () => {
	test("passes when the resolved version matches the pin", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.1.280" }),
		).not.toThrow()
	})

	test("asks for bun install when the install lags behind the pin", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.1.257" }),
		).toThrow(
			"@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code 2.1.257, but apps/app/sidecar/package.json pins 2.1.280. The install lags behind the pin: run bun install to resolve the pinned version.",
		)
	})

	test("asks for a pin bump when the dependency moved ahead", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.2.0" }),
		).toThrow(
			"@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code 2.2.0, but apps/app/sidecar/package.json pins 2.1.280. The dependency moved ahead of the pin: bump claudeCodeVersion in apps/app/sidecar/package.json to 2.2.0.",
		)
	})

	test("names both remedies when a version is not three numeric segments", () => {
		expect(() =>
			assertPinnedVersion({ pinned: "2.1.280", resolved: "2.1.280-nightly" }),
		).toThrow(
			"@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code 2.1.280-nightly, but apps/app/sidecar/package.json pins 2.1.280. Either run bun install to resolve the pinned version, or bump claudeCodeVersion in apps/app/sidecar/package.json.",
		)
	})
})

describe("readPinnedVersion", () => {
	test("reads the pinned version from the manifest", () => {
		expect(readPinnedVersion({ claudeCodeVersion: "2.1.280" })).toBe("2.1.280")
	})

	test("names the missing field rather than a version disagreement", () => {
		expect(() => readPinnedVersion({})).toThrow(
			"apps/app/sidecar/package.json carries no claudeCodeVersion string, so the Claude Code executable is not pinned.",
		)
	})
})
