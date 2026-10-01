import { describe, expect, it } from "vitest"

import { SPACE_GRAPH } from "@workspace/ui/components/space-graph.fixtures"
import {
	freshnessOf,
	linkEnd,
	neighbourhoodOf,
	toGraph,
} from "@workspace/ui/components/space-graph-model"

const OBSERVED_AT = "2026-03-04T09:30:00Z"

describe("toGraph", () => {
	it("keeps a plugin loaded by several bots as one node linked to each of them", () => {
		const graph = toGraph(SPACE_GRAPH)
		const linear = graph.nodes.filter((node) => node.id === "space-linear")
		const bots = graph.links
			.filter((link) => linkEnd(link.target) === "space-linear")
			.map((link) => linkEnd(link.source))

		expect(linear).toHaveLength(1)
		expect(linear[0]?.owner).toBeUndefined()
		expect(bots).toEqual(["bot-atlas", "bot-dorian"])
	})

	it("gives a plugin loaded by one bot to that bot", () => {
		const figma = toGraph(SPACE_GRAPH).nodes.find(
			(node) => node.id === "clemence-figma",
		)

		expect(figma?.owner?.blot).toBe("pink")
	})

	it("grows the radius with the token count", () => {
		const nodes = toGraph(SPACE_GRAPH).nodes
		const radiusOf = (id: string) =>
			nodes.find((node) => node.id === id)?.radius ?? 0

		expect(radiusOf("system-prompt")).toBeGreaterThan(radiusOf("user-profile"))
	})
})

describe("freshnessOf", () => {
	it("is full for a write within a day", () => {
		expect(freshnessOf("2026-03-03T10:00:00Z", OBSERVED_AT)).toBe(1)
	})

	it("is gone for a write older than a week", () => {
		expect(freshnessOf("2026-02-25T09:00:00Z", OBSERVED_AT)).toBe(0)
	})

	it("fades between a day and a week", () => {
		const freshness = freshnessOf("2026-03-01T09:30:00Z", OBSERVED_AT)

		expect(freshness).toBeGreaterThan(0)
		expect(freshness).toBeLessThan(1)
	})
})

describe("neighbourhoodOf", () => {
	it("keeps the bot and only what it loads", () => {
		const local = neighbourhoodOf(toGraph(SPACE_GRAPH), "bot-basile")
		const ids = local.nodes.map((node) => node.id)

		expect(ids).toContain("bot-basile")
		expect(ids).toContain("basile-changelog")
		expect(ids).not.toContain("bot-atlas")
		expect(ids).not.toContain("clemence-figma")
	})
})
