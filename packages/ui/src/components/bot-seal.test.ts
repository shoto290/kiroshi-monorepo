import { describe, expect, it } from "vitest"

import { VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"
import {
	BOT_SEAL_STATES,
	type BotSealState,
	isSealAnimated,
	sealFrame,
} from "@workspace/ui/components/bot-seal-frame"
import {
	MAX_ARMS,
	MIN_ARMS,
	SEAL_FAMILIES,
	type SealSolid,
	sealSolid,
	sealStacks,
} from "@workspace/ui/components/bot-seal-solid"

const SEEDS = Array.from({ length: 64 }, (_, at) => `bot-${at}-7c1e${at * 5}`)

const pathOf = (seed: string, state?: BotSealState, elapsed = 0) => {
	const { lit, dim } = sealFrame({ solid: sealSolid(seed), state, elapsed })
	return `${lit}|${dim}`
}

const strokeCount = ({
	solid,
	state,
}: {
	solid: SealSolid
	state: BotSealState
}) => {
	const { lit, dim } = sealFrame({ solid, state, elapsed: 0 })
	return `${lit}${dim}`.split("M").length - 1
}

const coordinatesOf = (path: string) =>
	path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []

describe("sealSolid", () => {
	it("derives the same description from the same seed", () => {
		for (const seed of SEEDS) {
			expect(sealSolid(seed)).toEqual(sealSolid(seed))
		}
	})

	it("keeps the arm count and the shortened arm inside the family range", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			expect(solid.arms).toBeGreaterThanOrEqual(MIN_ARMS)
			expect(solid.arms).toBeLessThanOrEqual(MAX_ARMS)
			expect(solid.shortArm).toBeLessThan(solid.arms)
		}
	})

	it("reaches every family", () => {
		const families = new Set(SEEDS.map((seed) => sealSolid(seed).family))

		expect(families.size).toBe(SEAL_FAMILIES.length)
	})

	it("builds a solid out of an empty seed", () => {
		const solid = sealSolid("")
		const stacks = sealStacks(solid)

		expect(solid.arms).toBeGreaterThanOrEqual(MIN_ARMS)
		expect(stacks.length).toBeGreaterThan(0)
		expect(pathOf("")).not.toBe("")
	})
})

describe("sealFrame", () => {
	it("emits the same path data for one seed rendered twice", () => {
		for (const seed of SEEDS) {
			expect(pathOf(seed)).toBe(pathOf(seed))
		}
	})

	it("emits path data that differs between seeds", () => {
		const paths = new Set(SEEDS.map((seed) => pathOf(seed)))

		expect(paths.size).toBe(SEEDS.length)
	})

	it("keeps every point inside the view box", () => {
		for (const seed of SEEDS) {
			for (const state of BOT_SEAL_STATES) {
				for (const elapsed of [0, 700, 1900, 4300]) {
					for (const value of coordinatesOf(pathOf(seed, state, elapsed))) {
						expect(value).toBeGreaterThanOrEqual(0)
						expect(value).toBeLessThanOrEqual(VIEW_BOX)
					}
				}
			}
		}
	})

	it("moves the animated states across frames and holds the others still", () => {
		for (const state of BOT_SEAL_STATES) {
			const moved = pathOf(SEEDS[0], state, 0) !== pathOf(SEEDS[0], state, 620)

			expect(moved).toBe(isSealAnimated(state))
		}
	})

	it("flattens the done state onto fewer strokes than the solid it came from", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)

			expect(strokeCount({ solid, state: "done" })).toBeLessThan(
				strokeCount({ solid, state: "waiting" }),
			)
		}
	})
})
