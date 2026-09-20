import { describe, expect, it } from "vitest"

import {
	MARBLE_BOX,
	MARBLE_SHADE_COUNT,
	marbleLayers,
	marbleShade,
	marbleTransform,
	seedHash,
} from "@workspace/ui/components/bot-avatar-marble"
import { nextSeed } from "@workspace/ui/components/bot-settings"

const SEEDS = Array.from({ length: 64 }, (_, at) => `bot-${at}-9f3c${at * 7}`)

const TINT = "var(--bot-blot-blue)"

const ROSTER_SEEDS = [
	"bot-1",
	"bot-2",
	"bot-3",
	"bot-4",
	"bot-5",
	"bot-6",
	"bot-7",
	"bot-8",
]

const MARBLE_SPREAD = 0.95

const geometryOf = (seed?: string) => marbleLayers(seed).map(marbleTransform)

const marbleOf = (seed?: string) =>
	marbleLayers(seed)
		.map((layer) => `${layer.shade}@${marbleTransform(layer)}`)
		.join("|")

describe("seedHash", () => {
	it("reads the same number from the same seed", () => {
		expect(seedHash("bot-7")).toBe(seedHash("bot-7"))
	})

	it("reads a different number from a different seed", () => {
		expect(seedHash("bot-7")).not.toBe(seedHash("bot-8"))
	})

	it("stays a non-negative integer across a roster of ids", () => {
		for (const seed of SEEDS) {
			const hash = seedHash(seed)

			expect(Number.isInteger(hash)).toBe(true)
			expect(hash).toBeGreaterThanOrEqual(0)
		}
	})
})

describe("marbleLayers", () => {
	it("draws the same three layers twice from one seed", () => {
		expect(marbleLayers("bot-7")).toEqual(marbleLayers("bot-7"))
	})

	it("draws different geometry for two seeds", () => {
		expect(geometryOf("bot-7")).not.toEqual(geometryOf("bot-8"))
	})

	it("falls back to the unseeded marble when no seed is given", () => {
		expect(marbleLayers()).toEqual(marbleLayers(""))
	})

	it("keeps every layer inside the shade palette", () => {
		for (const seed of SEEDS) {
			for (const layer of marbleLayers(seed)) {
				expect(layer.shade).toBeGreaterThanOrEqual(0)
				expect(layer.shade).toBeLessThan(MARBLE_SHADE_COUNT)
			}
		}
	})

	it("holds every translation, rotation and scale in the authored ranges", () => {
		for (const seed of SEEDS) {
			for (const layer of marbleLayers(seed)) {
				expect(Math.abs(layer.translateX)).toBeLessThan(MARBLE_BOX / 10)
				expect(Math.abs(layer.translateY)).toBeLessThan(MARBLE_BOX / 10)
				expect(Math.abs(layer.rotate)).toBeLessThan(360)
				expect(layer.scale).toBeGreaterThanOrEqual(1.2)
				expect(layer.scale).toBeLessThanOrEqual(1.5)
			}
		}
	})

	it("gives each layer its own translation, rotation and scale", () => {
		const posed = new Set(
			SEEDS.flatMap((seed) => {
				const [, middle, top] = marbleLayers(seed)
				return marbleTransform(middle) === marbleTransform(top) ? [seed] : []
			}),
		)

		expect(posed.size).toBe(0)
	})

	it("draws a marble of its own for every id of a roster", () => {
		const drawn = new Set(ROSTER_SEEDS.map(marbleOf))

		expect(drawn.size).toBe(ROSTER_SEEDS.length)
	})

	it("spreads a long roster of ids over as many marbles", () => {
		const drawn = new Set(SEEDS.map(marbleOf))

		expect(drawn.size / SEEDS.length).toBeGreaterThan(MARBLE_SPREAD)
	})
})

describe("marbleShade", () => {
	it("derives every shade from the chosen tint alone", () => {
		const shades = Array.from({ length: MARBLE_SHADE_COUNT }, (_, at) =>
			marbleShade(TINT, at),
		)

		expect(shades).toEqual([
			"oklch(from var(--bot-blot-blue) l c h)",
			"oklch(from var(--bot-blot-blue) calc(l + 0.08) c h)",
			"oklch(from var(--bot-blot-blue) calc(l - 0.12) c h)",
		])
		expect(new Set(shades).size).toBe(MARBLE_SHADE_COUNT)
	})
})

describe("nextSeed", () => {
	it("hands back a seed the identity was not already carrying", () => {
		expect(nextSeed("bot-7")).not.toBe("bot-7")
		expect(nextSeed()).not.toBe("")
	})

	it("draws a different marble on every press", () => {
		const first = nextSeed("bot-7")
		const second = nextSeed(first)

		expect(geometryOf(first)).not.toEqual(geometryOf("bot-7"))
		expect(geometryOf(second)).not.toEqual(geometryOf(first))
	})
})
