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
} from "@workspace/ui/components/bot-seal-solid"

const SEEDS = Array.from({ length: 64 }, (_, at) => `bot-${at}-7c1e${at * 5}`)
const CYCLE_SEEDS = SEEDS.slice(0, 8)
const CYCLE_SPAN = 12000
const CYCLE_STEP = 25
const COARSE_STEP = 300
const samplesEvery = (step: number) =>
	Array.from({ length: CYCLE_SPAN / step + 1 }, (_, at) => at * step)
const CYCLE_SAMPLES = samplesEvery(CYCLE_STEP)
const COARSE_SAMPLES = samplesEvery(COARSE_STEP)
const BOUNDS_STEP_LIMIT = 10
const LIT_STEP_LIMIT = 0.5
const ANIMATED_STATES = BOT_SEAL_STATES.filter(isSealAnimated)

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

type Bounds = [number, number, number, number]

const boundsOf = (path: string): Bounds => {
	const values = coordinatesOf(path)
	const xs = values.filter((_, at) => at % 2 === 0)
	const ys = values.filter((_, at) => at % 2 === 1)
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

const boundsShift = (from: Bounds, to: Bounds) =>
	Math.max(...from.map((value, at) => Math.abs(value - to[at])))

const spanOf = (path: string) => {
	const values = coordinatesOf(path)
	return { lowest: Math.min(...values), highest: Math.max(...values) }
}

const sampleOf = (seed: string, state: BotSealState, elapsed: number) => {
	const { lit, dim } = sealFrame({ solid: sealSolid(seed), state, elapsed })
	return {
		bounds: boundsOf(`${lit}${dim}`),
		litStrokes: lit.split("M").length - 1,
		strokes: `${lit}${dim}`.split("M").length - 1,
	}
}

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

		expect(solid.arms).toBeGreaterThanOrEqual(MIN_ARMS)
		expect(solid.stacks.length).toBeGreaterThan(0)
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

	it("keeps every point inside the view box across a full cycle", () => {
		for (const state of BOT_SEAL_STATES) {
			const spans = CYCLE_SEEDS.flatMap((seed) =>
				COARSE_SAMPLES.map((elapsed) => spanOf(pathOf(seed, state, elapsed))),
			)

			expect(Math.min(...spans.map(({ lowest }) => lowest))).toBeGreaterThan(0)
			expect(Math.max(...spans.map(({ highest }) => highest))).toBeLessThan(
				VIEW_BOX,
			)
		}
	})

	it("closes every animated cycle without a jump", () => {
		for (const state of ANIMATED_STATES) {
			const frames = CYCLE_SAMPLES.map((elapsed) =>
				sampleOf(CYCLE_SEEDS[0], state, elapsed),
			)
			for (let at = 1; at < frames.length; at += 1) {
				const previous = frames[at - 1]
				const current = frames[at]

				expect(boundsShift(previous.bounds, current.bounds)).toBeLessThan(
					BOUNDS_STEP_LIMIT,
				)
				expect(Math.abs(current.litStrokes - previous.litStrokes)).toBeLessThan(
					current.strokes * LIT_STEP_LIMIT,
				)
			}
		}
	})

	it("breaks one arm off its axis while the state is blocked", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			const held = sealFrame({ solid, state: "waiting", elapsed: 0 })
			const broken = sealFrame({ solid, state: "blocked", elapsed: 0 })

			expect(broken.lit + broken.dim).not.toBe(held.lit + held.dim)
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
