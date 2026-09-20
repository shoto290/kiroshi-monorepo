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
const CUT_STEP_LIMIT = 12
const RATE_SPREAD_LIMIT = 1.5
const MOVING_SHARE = 0.02
const SLOWEST_SHARE = 0.1
const MEASURABLE_PEAK = 1
const HIDDEN_EDGES = 2
const ANIMATED_STATES = BOT_SEAL_STATES.filter(isSealAnimated)

const pathOf = (seed: string, state?: BotSealState, elapsed = 0) => {
	const { lit, dim } = sealFrame({ solid: sealSolid(seed), state, elapsed })
	return `${lit}|${dim}`
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
	const [lowestX, lowestY, highestX, highestY] = boundsOf(path)
	return {
		lowest: Math.min(lowestX, lowestY),
		highest: Math.max(highestX, highestY),
	}
}

const strokesIn = (path: string) => path.split("M").filter(Boolean)

const edgesIn = (lit: string, dim: string) => {
	const strokes = [...strokesIn(lit), ...strokesIn(dim)]
	const cutY = boundsOf(lit)[3]
	const halved = strokes.filter((stroke) => {
		const [, from, , to] = coordinatesOf(stroke)
		return from === cutY || to === cutY
	}).length
	return strokes.length - halved / 2
}

const edgeTotalOf = ({ stacks }: SealSolid) =>
	stacks.reduce(
		(total, { profile, levels }) =>
			total + profile.length * (2 * levels.length - 1),
		0,
	)

const sampleOf = (solid: SealSolid, state: BotSealState, elapsed: number) => {
	const { lit, dim } = sealFrame({ solid, state, elapsed })
	const bounds = boundsOf(`${lit}${dim}`)
	return {
		bounds,
		cut: lit === "" ? bounds[1] : boundsOf(lit)[3],
		edges: edgesIn(lit, dim),
		strokes: strokesIn(`${lit}${dim}`).length,
	}
}

const stepsOf = (solid: SealSolid, state: BotSealState) => {
	const frames = CYCLE_SAMPLES.map((elapsed) => sampleOf(solid, state, elapsed))
	return frames.slice(1).map((current, at) => ({
		bounds: boundsShift(frames[at].bounds, current.bounds),
		cut: Math.abs(frames[at].cut - current.cut),
	}))
}

const rateSpreadOf = (solid: SealSolid, state: BotSealState) => {
	const steps = stepsOf(solid, state).map(({ bounds, cut }) =>
		Math.max(bounds, cut),
	)
	const peak = Math.max(...steps)
	if (peak <= MEASURABLE_PEAK) return null
	const moving = steps
		.filter((step) => step > peak * MOVING_SHARE)
		.sort((one, other) => one - other)
	return peak / moving[Math.floor(moving.length * SLOWEST_SHARE)]
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
		const solid = sealSolid(CYCLE_SEEDS[0])
		for (const state of ANIMATED_STATES) {
			const steps = stepsOf(solid, state)

			expect(Math.max(...steps.map(({ bounds }) => bounds))).toBeLessThan(
				BOUNDS_STEP_LIMIT,
			)
			expect(Math.max(...steps.map(({ cut }) => cut))).toBeLessThan(
				CUT_STEP_LIMIT,
			)
		}
	})

	it("advances no animated value at a constant rate", () => {
		for (const state of ANIMATED_STATES) {
			const spreads = CYCLE_SEEDS.map((seed) =>
				rateSpreadOf(sealSolid(seed), state),
			).filter((spread): spread is number => spread !== null)

			expect(spreads.length).toBeGreaterThan(0)
			for (const spread of spreads) {
				expect(spread).toBeGreaterThan(RATE_SPREAD_LIMIT)
			}
		}
	})

	it("hides the far edges of a turning solid", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			const turning = COARSE_SAMPLES.map(
				(elapsed) => sampleOf(solid, "thinking", elapsed).edges,
			)

			expect(Math.min(...turning)).toBeLessThan(
				edgeTotalOf(solid) - HIDDEN_EDGES,
			)
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

			expect(sampleOf(solid, "done", 0).strokes).toBeLessThan(
				sampleOf(solid, "waiting", 0).strokes,
			)
		}
	})
})
