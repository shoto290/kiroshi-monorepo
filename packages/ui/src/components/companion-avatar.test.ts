import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
	type CompanionAvatarInput,
	companionAvatar,
} from "@workspace/ui/components/companion-avatar"
import { BLOT_TINTS } from "@workspace/ui/components/companion-colour"

const FIXTURE = "./companion-avatar.fixture.json"
const SOURCE_ROOT = join(import.meta.dirname, "..")
const RESOURCES = join(
	import.meta.dirname,
	"../../../../apps/ios/Kiroshi/Resources",
)
const WORKING_FRAME = 1234

const REPLAY_FIXTURE_IN_NODE = `
const { readFileSync } = require("node:fs")
const { deepStrictEqual } = require("node:assert")
const [bundle, fixture] = process.argv.slice(1)
;(0, eval)(readFileSync(bundle, "utf8"))
for (const { input, output } of JSON.parse(readFileSync(fixture, "utf8")))
	deepStrictEqual(companionAvatar(input), output)
`

const NAMES = [
	"Lyra",
	"Orion",
	"Nova",
	"Mira",
	"Vega",
	"Juno",
	"Castor",
	"Altair",
	"Atlas",
	"Kiroshi",
]

const FIXTURE_INPUTS: CompanionAvatarInput[] = NAMES.flatMap((name, index) =>
	[undefined, BLOT_TINTS[index % BLOT_TINTS.length]].flatMap((tint) =>
		(["idle", "working"] as const).flatMap((state) =>
			(["light", "dark"] as const).map((theme) => ({
				name,
				...(tint && { tint }),
				state,
				time: state === "idle" ? 0 : WORKING_FRAME,
				theme,
			})),
		),
	),
)

const IMPORT = /^import\s+(type\s+)?[\s\S]*?from\s+"([^"]+)"/gm
const FORBIDDEN =
	/\breact\b|\bdocument\b|\bwindow\b|getComputedStyle|var\(--|\.css\b/

const runtimeImportsOf = (path: string): string[] =>
	Array.from(readFileSync(path, "utf8").matchAll(IMPORT))
		.filter(([, isType]) => !isType)
		.map(([, , specifier]) => specifier)

const moduleGraph = (path: string, seen = new Set<string>()): Set<string> => {
	seen.add(path)
	for (const specifier of runtimeImportsOf(path)) {
		const next = specifier.startsWith("@workspace/ui/")
			? join(SOURCE_ROOT, `${specifier.slice("@workspace/ui/".length)}.ts`)
			: specifier
		if (!seen.has(next)) moduleGraph(next, seen)
	}
	return seen
}

describe("companionAvatar", () => {
	it("draws every fixture input the way the committed fixture records it", async () => {
		const fixture = FIXTURE_INPUTS.map((input) => ({
			input,
			output: companionAvatar(input),
		}))

		await expect(
			`${JSON.stringify(fixture, null, "\t")}\n`,
		).toMatchFileSnapshot(FIXTURE)
	})

	it("draws the fixture again from the iOS bundle evaluated alone in node", () => {
		expect(() =>
			execFileSync("node", [
				"-e",
				REPLAY_FIXTURE_IN_NODE,
				join(RESOURCES, "companion-avatar.js"),
				join(RESOURCES, "companion-avatar.fixture.json"),
			]),
		).not.toThrow()
	})

	it("imports nothing but plain TypeScript free of React, the DOM and CSS", () => {
		for (const path of moduleGraph(
			join(import.meta.dirname, "companion-avatar.ts"),
		)) {
			expect(path).toMatch(/\.ts$/)
			expect(readFileSync(path, "utf8")).not.toMatch(FORBIDDEN)
		}
	})
})
