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
	type SealSolid,
	sealSolid,
} from "@workspace/ui/components/bot-seal-solid"

const SEEDS = Array.from({ length: 64 }, (_, at) => `bot-${at}-7c1e${at * 5}`)
const CYCLE_SEEDS = SEEDS.slice(0, 8)
const CYCLE_SPAN = 12000
const samplesEvery = (step: number) =>
	Array.from({ length: CYCLE_SPAN / step + 1 }, (_, at) => at * step)
const CYCLE_SAMPLES = samplesEvery(25)
const RATE_SAMPLES = samplesEvery(100)
const COARSE_SAMPLES = samplesEvery(300)
const BOUNDS_STEP_LIMIT = 10
const RATE_SPREAD_LIMIT = 1.5
const MOVING_SHARE = 0.02
const SLOWEST_SHARE = 0.1
const FASTEST_SHARE = 0.9
const WALL_SHARE = 0.1
const WALL_STROKES = 3
const VERTICES_PER_ARM = 3
const EDGES_PER_VERTEX = 3
const CHIP_SIZE = 40
const CHIP_UNIT = CHIP_SIZE / VIEW_BOX
const READ_LIMIT = 2
const READ_SAMPLES = samplesEvery(CYCLE_SPAN / 40)
const ANIMATED_STATES = BOT_SEAL_STATES.filter(isSealAnimated)
const ONE_PATH = /^(M-?[\d.]+ -?[\d.]+L-?[\d.]+ -?[\d.]+)+$/

const pathOf = (seed: string, state?: BotSealState, elapsed = 0) =>
	sealFrame({ solid: sealSolid(seed), state, elapsed })

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
		width: Math.max(highestX - lowestX, highestY - lowestY),
	}
}

const strokesIn = (path: string) => path.split("M").filter(Boolean)

const edgesIn = (path: string) => strokesIn(path).length

type Point = [number, number]

const pointsIn = (path: string): Point[] => {
	const values = coordinatesOf(path)
	return Array.from(
		{ length: values.length / 2 },
		(_, at): Point => [values[at * 2], values[at * 2 + 1]],
	)
}

const apartFrom = (from: Point[], to: Point[]) =>
	Math.max(
		...from.map(([x, y]) =>
			Math.min(
				...to.map(([otherX, otherY]) => Math.hypot(x - otherX, y - otherY)),
			),
		),
	)

const awayFrom = (one: Point[], other: Point[]) =>
	Math.max(apartFrom(one, other), apartFrom(other, one))

const wallIn = (path: string) => {
	const walls = new Map<string, number>()
	for (const stroke of strokesIn(path)) {
		const [fromX, fromY, toX, toY] = coordinatesOf(stroke)
		const offset = `${toX - fromX},${toY - fromY}`
		walls.set(offset, (walls.get(offset) ?? 0) + 1)
	}
	const [offset, drawn] = [...walls].reduce((most, entry) =>
		entry[1] > most[1] ? entry : most,
	)
	if (drawn < WALL_STROKES) return 0
	const [x, y] = offset.split(",").map(Number)
	return Math.hypot(x, y)
}

const stepsOf = (solid: SealSolid, state: BotSealState, samples: number[]) => {
	const frames = samples.map((elapsed) =>
		boundsOf(sealFrame({ solid, state, elapsed })),
	)
	return frames.slice(1).map((bounds, at) => boundsShift(frames[at], bounds))
}

const share = (sorted: number[], at: number) =>
	sorted[Math.floor((sorted.length - 1) * at)]

const rateSpreadOf = (solid: SealSolid, state: BotSealState) => {
	const steps = stepsOf(solid, state, RATE_SAMPLES)
	const peak = Math.max(...steps)
	const moving = steps
		.filter((step) => step > peak * MOVING_SHARE)
		.sort((one, other) => one - other)
	return share(moving, FASTEST_SHARE) / share(moving, SLOWEST_SHARE)
}

describe("sealSolid", () => {
	it("derives the same seal from the same seed", () => {
		for (const seed of SEEDS) {
			expect(sealSolid(seed)).toEqual(sealSolid(seed))
		}
	})

	it("keeps the arm count inside its range and one profile per seal", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			expect(solid.arms).toBeGreaterThanOrEqual(MIN_ARMS)
			expect(solid.arms).toBeLessThanOrEqual(MAX_ARMS)
			expect(solid.profile).toHaveLength(solid.arms * VERTICES_PER_ARM)
		}
	})

	it("parts every tip with a notch cut back toward the centre", () => {
		for (const seed of SEEDS) {
			const { profile } = sealSolid(seed)
			const radii = profile.map(({ x, y }) => Math.hypot(x, y))
			for (let at = 0; at < radii.length; at += VERTICES_PER_ARM) {
				expect(radii[at + 2]).toBeLessThan(radii[at])
				expect(radii[at + 2]).toBeLessThan(radii[at + 1])
			}
		}
	})

	it("varies reach, width and tip between the arms of one seal", () => {
		for (const seed of SEEDS) {
			const { profile, arms } = sealSolid(seed)
			const reaches = new Set<number>()
			const tips = new Set<number>()
			const notches = new Set<number>()
			for (let arm = 0; arm < arms; arm += 1) {
				const [start, end, notch] = profile.slice(
					arm * VERTICES_PER_ARM,
					arm * VERTICES_PER_ARM + VERTICES_PER_ARM,
				)
				reaches.add(Math.hypot(start.x, start.y))
				tips.add(Math.hypot(end.x - start.x, end.y - start.y))
				notches.add(Math.hypot(notch.x, notch.y))
			}

			expect(reaches.size).toBe(arms)
			expect(tips.size).toBe(arms)
			expect(notches.size).toBe(arms)
		}
	})

	it("builds a seal out of an empty seed", () => {
		const solid = sealSolid("")

		expect(solid.arms).toBeGreaterThanOrEqual(MIN_ARMS)
		expect(pathOf("")).not.toBe("")
	})
})

describe("sealFrame", () => {
	it("emits one path of straight strokes per frame", () => {
		for (const seed of CYCLE_SEEDS) {
			for (const state of BOT_SEAL_STATES) {
				expect(pathOf(seed, state)).toMatch(ONE_PATH)
			}
		}
	})

	it("emits the same path for one seed rendered twice", () => {
		for (const seed of SEEDS) {
			expect(pathOf(seed)).toBe(pathOf(seed))
		}
	})

	it("emits a path that differs between seeds", () => {
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

	it("keeps the wall under a tenth of the width of the mark", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			for (const state of BOT_SEAL_STATES) {
				for (const elapsed of COARSE_SAMPLES) {
					const frame = sealFrame({ solid, state, elapsed })

					expect(wallIn(frame)).toBeLessThan(spanOf(frame).width * WALL_SHARE)
				}
			}
		}
	})

	it("moves every state at least two rendered pixels at the chip size", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			const resting = pointsIn(sealFrame({ solid, elapsed: 0 }))
			for (const state of BOT_SEAL_STATES) {
				const farthest = Math.max(
					...READ_SAMPLES.map((elapsed) =>
						awayFrom(pointsIn(sealFrame({ solid, state, elapsed })), resting),
					),
				)

				expect(farthest * CHIP_UNIT).toBeGreaterThanOrEqual(READ_LIMIT)
			}
		}
	})

	it("keeps every tip of the profile drawn in every state", () => {
		for (const seed of CYCLE_SEEDS) {
			const solid = sealSolid(seed)
			for (const state of BOT_SEAL_STATES) {
				for (const elapsed of COARSE_SAMPLES) {
					expect(
						edgesIn(sealFrame({ solid, state, elapsed })),
					).toBeGreaterThanOrEqual(solid.profile.length)
				}
			}
		}
	})

	it("settles the done state onto the outline alone", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)

			expect(edgesIn(sealFrame({ solid, state: "done", elapsed: 0 }))).toBe(
				solid.profile.length,
			)
		}
	})

	it("hides the far edges of a turning solid", () => {
		for (const seed of SEEDS) {
			const solid = sealSolid(seed)
			const turning = COARSE_SAMPLES.map((elapsed) =>
				edgesIn(sealFrame({ solid, state: "thinking", elapsed })),
			)

			expect(Math.min(...turning)).toBeLessThan(
				solid.profile.length * EDGES_PER_VERTEX,
			)
		}
	})

	it("closes every animated cycle without a jump", () => {
		const solid = sealSolid(CYCLE_SEEDS[0])
		for (const state of ANIMATED_STATES) {
			const steps = stepsOf(solid, state, CYCLE_SAMPLES)

			expect(Math.max(...steps)).toBeLessThan(BOUNDS_STEP_LIMIT)
		}
	})

	it("advances no animated value at a constant rate", () => {
		for (const state of ANIMATED_STATES) {
			for (const seed of CYCLE_SEEDS) {
				expect(rateSpreadOf(sealSolid(seed), state)).toBeGreaterThan(
					RATE_SPREAD_LIMIT,
				)
			}
		}
	})

	it("moves the animated states across frames and holds the others still", () => {
		for (const state of BOT_SEAL_STATES) {
			const moved = pathOf(SEEDS[0], state, 0) !== pathOf(SEEDS[0], state, 620)

			expect(moved).toBe(isSealAnimated(state))
		}
	})
})
