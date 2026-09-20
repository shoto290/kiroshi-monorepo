import { describe, expect, it } from "bun:test"

import {
	compareItems,
	compareStories,
	mergeVerdicts,
	withOrdinals,
} from "./baseline"

describe("baseline items", () => {
	it("fails on an item the baseline does not record, naming it", () => {
		const verdict = compareItems({
			area: "knip",
			committed: ["exports :: a.ts :: old"],
			live: ["exports :: a.ts :: old", "exports :: b.ts :: fresh"],
		})

		expect(verdict.failures).toHaveLength(1)
		expect(verdict.failures[0]).toContain("exports :: b.ts :: fresh")
		expect(verdict.warnings).toEqual([])
	})

	it("warns without failing on a recorded item no longer reported", () => {
		const verdict = compareItems({
			area: "tests",
			committed: ["ui :: panel.stories.tsx :: Picking The Mode"],
			live: [],
		})

		expect(verdict.failures).toEqual([])
		expect(verdict.warnings).toHaveLength(1)
		expect(verdict.warnings[0]).toContain("Picking The Mode")
	})

	it("passes when the reported items are exactly the recorded ones", () => {
		const verdict = compareItems({
			area: "biome",
			committed: ["lint/style/noNonNullAssertion :: a.ts :: const x = y!"],
			live: ["lint/style/noNonNullAssertion :: a.ts :: const x = y!"],
		})

		expect(mergeVerdicts([verdict])).toEqual({ failures: [], warnings: [] })
	})

	it("keys twin items on their own rank so trading one for another shows", () => {
		expect(withOrdinals(["same", "same", "other"])).toEqual([
			"other",
			"same",
			"same #2",
		])
	})
})

describe("baseline stories", () => {
	it("fails when a family grew, naming the family and both counts", () => {
		const verdict = compareStories({
			committed: { Primitives: 12 },
			live: { Primitives: 13 },
		})

		expect(verdict.failures).toHaveLength(1)
		expect(verdict.failures[0]).toContain("Primitives")
		expect(verdict.failures[0]).toContain("13")
		expect(verdict.failures[0]).toContain("12")
	})

	it("fails when a family shrank", () => {
		const verdict = compareStories({
			committed: { Overlays: 9 },
			live: { Overlays: 8 },
		})

		expect(verdict.failures).toHaveLength(1)
		expect(verdict.failures[0]).toContain("Overlays")
	})

	it("fails on a family the baseline never recorded", () => {
		const verdict = compareStories({ committed: {}, live: { Forms: 4 } })

		expect(verdict.failures).toHaveLength(1)
		expect(verdict.failures[0]).toContain("Forms")
	})

	it("passes when every family holds its recorded count", () => {
		const verdict = compareStories({
			committed: { Forms: 4, Layout: 2 },
			live: { Forms: 4, Layout: 2 },
		})

		expect(verdict.failures).toEqual([])
	})
})
