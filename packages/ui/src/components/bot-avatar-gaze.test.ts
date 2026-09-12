import { describe, expect, it } from "vitest"

import {
	type BotAvatarGazeCadence,
	type BotAvatarRandom,
	blinkDelay,
	blinksWithDart,
	clampGaze,
	drawGazeTarget,
	GAZE_BLINK_DELAY,
	GAZE_BLINK_TRAVEL,
	GAZE_CADENCE,
	GAZE_DART_DURATION,
	GAZE_HEAD_DELAY,
	GAZE_HEAD_PITCH_LIMIT,
	GAZE_HEAD_PITCH_RATIO,
	GAZE_HEAD_YAW_LIMIT,
	GAZE_HEAD_YAW_RATIO,
	GAZE_HOLD_FLOOR,
	GAZE_PITCH_DOWN_LIMIT,
	GAZE_PITCH_UP_LIMIT,
	GAZE_YAW_LIMIT,
	gazeAlong,
	glanceDelay,
	headGazeAsPose,
	headGazeFor,
	isGazeCentred,
	rigFromHeadGaze,
} from "@workspace/ui/components/bot-avatar-gaze"

const DRAWS = 30000
const CENTRE_TOLERANCE = 0.02
const EPSILON = 1e-9

const seeded = (seed: number): BotAvatarRandom => {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
}

const constant =
	(value: number): BotAvatarRandom =>
	() =>
		value

const cadences = Object.entries(GAZE_CADENCE) as [
	string,
	BotAvatarGazeCadence,
][]

describe("bot avatar gaze", () => {
	it("darts at constant speed over 80 ms", () => {
		const from = { yaw: 0, pitch: 0 }
		const to = { yaw: 10, pitch: -4 }

		expect(GAZE_DART_DURATION).toBe(80)
		expect(gazeAlong(from, to, 0)).toEqual(from)
		expect(gazeAlong(from, to, 40)).toEqual({ yaw: 5, pitch: -2 })
		expect(
			gazeAlong(from, to, 60).yaw - gazeAlong(from, to, 40).yaw,
		).toBeCloseTo(gazeAlong(from, to, 40).yaw - gazeAlong(from, to, 20).yaw, 10)
		expect(gazeAlong(from, to, GAZE_DART_DURATION)).toEqual(to)
		expect(gazeAlong(from, to, 500)).toEqual(to)
	})

	it("holds a target for at least 420 ms before the next glance", () => {
		expect(GAZE_HOLD_FLOOR).toBe(420)
		for (const [, cadence] of cadences) {
			expect(glanceDelay(cadence, constant(0))).toBeGreaterThanOrEqual(
				GAZE_HOLD_FLOOR,
			)
			expect(glanceDelay(cadence, constant(0))).toBe(
				Math.max(GAZE_HOLD_FLOOR, cadence.interval[0]),
			)
			expect(glanceDelay(cadence, constant(1 - EPSILON))).toBeLessThanOrEqual(
				cadence.interval[1],
			)
		}
	})

	it("keeps every state interval, amplitude and axis bias", () => {
		expect(GAZE_CADENCE.thinking?.interval).toEqual([1400, 2600])
		expect(GAZE_CADENCE.searching?.interval).toEqual([700, 1400])
		expect(GAZE_CADENCE.working?.interval).toEqual([1600, 3000])
		expect(GAZE_CADENCE.writing?.interval).toEqual([1200, 2200])
		expect(GAZE_CADENCE.waiting?.interval).toEqual([2600, 4800])
		expect(GAZE_CADENCE.searching?.pitchScale).toBe(0.4)
		expect(GAZE_CADENCE.working?.looksDownOnly).toBe(true)
		expect(GAZE_CADENCE.writing?.yawLimit).toBe(6)
		expect(GAZE_CADENCE.writing?.heldPitch).toBe(GAZE_PITCH_UP_LIMIT)
		expect(GAZE_CADENCE.waiting?.returnsToCentre).toBe(true)
	})

	it("clamps every drawn target to the amplitude cap", () => {
		const random = seeded(7)
		for (const [, cadence] of cadences) {
			for (let draw = 0; draw < DRAWS / cadences.length; draw += 1) {
				const target = drawGazeTarget(cadence, random)
				expect(Math.abs(target.yaw)).toBeLessThanOrEqual(
					Math.min(GAZE_YAW_LIMIT, cadence.yawLimit) + EPSILON,
				)
				expect(target.pitch).toBeLessThanOrEqual(GAZE_PITCH_DOWN_LIMIT)
				expect(target.pitch).toBeGreaterThanOrEqual(-GAZE_PITCH_UP_LIMIT)
				if (cadence.looksDownOnly)
					expect(target.pitch).toBeGreaterThanOrEqual(0)
			}
		}
		expect(clampGaze({ yaw: 40, pitch: 40 })).toEqual({
			yaw: GAZE_YAW_LIMIT,
			pitch: GAZE_PITCH_DOWN_LIMIT,
		})
		expect(clampGaze({ yaw: -40, pitch: -40 })).toEqual({
			yaw: -GAZE_YAW_LIMIT,
			pitch: -GAZE_PITCH_UP_LIMIT,
		})
	})

	it("draws one target in three at the exact centre", () => {
		const random = seeded(11)
		const cadence = GAZE_CADENCE.thinking as BotAvatarGazeCadence
		let centred = 0
		for (let draw = 0; draw < DRAWS; draw += 1) {
			if (isGazeCentred(drawGazeTarget(cadence, random))) centred += 1
		}

		expect(centred / DRAWS).toBeCloseTo(1 / 3, CENTRE_TOLERANCE)
		expect(drawGazeTarget(cadence, constant(0))).toEqual({ yaw: 0, pitch: 0 })
	})

	it("follows the eyes with the head after 90 ms, at its own ratios", () => {
		expect(GAZE_HEAD_DELAY).toBe(90)
		expect(headGazeFor({ yaw: 10, pitch: 8 })).toEqual({
			yaw: 10 * GAZE_HEAD_YAW_RATIO,
			pitch: 8 * GAZE_HEAD_PITCH_RATIO,
		})
		const capped = headGazeFor({
			yaw: GAZE_YAW_LIMIT,
			pitch: GAZE_PITCH_DOWN_LIMIT,
		})
		expect(capped.yaw).toBeCloseTo(6.3, 10)
		expect(capped.pitch).toBeCloseTo(2.7, 10)
		expect(headGazeFor({ yaw: 100, pitch: 100 })).toEqual({
			yaw: GAZE_HEAD_YAW_LIMIT,
			pitch: GAZE_HEAD_PITCH_LIMIT,
		})
		expect(headGazeFor({ yaw: -100, pitch: -100 })).toEqual({
			yaw: -GAZE_HEAD_YAW_LIMIT,
			pitch: -GAZE_HEAD_PITCH_LIMIT,
		})
	})

	it("turns a downward head gaze into a downward rig pitch", () => {
		expect(headGazeAsPose({ yaw: 0, pitch: 4 }).pitch).toBeLessThan(0)
		expect(headGazeAsPose({ yaw: 4, pitch: 0 }).yaw).toBeGreaterThan(0)
		expect(headGazeAsPose({ yaw: 4, pitch: 4 }).roll).toBe(0)
	})

	it("drives the rig from the head gaze yaw alone", () => {
		expect(rigFromHeadGaze(4)).toEqual({ translation: 0.44, tilt: 0.2 })
		expect(rigFromHeadGaze(GAZE_HEAD_YAW_LIMIT).translation).toBeCloseTo(
			0.77,
			10,
		)
		expect(rigFromHeadGaze(40).translation).toBe(1.2)
		expect(rigFromHeadGaze(-40).translation).toBe(-1.2)
	})

	it("blinks on three long darts in ten, between 40 and 80 ms", () => {
		expect(blinksWithDart(GAZE_BLINK_TRAVEL, constant(0))).toBe(false)
		expect(blinksWithDart(GAZE_BLINK_TRAVEL + 1, constant(0.29))).toBe(true)
		expect(blinksWithDart(GAZE_BLINK_TRAVEL + 1, constant(0.31))).toBe(false)
		expect(blinkDelay(constant(0))).toBe(GAZE_BLINK_DELAY[0])
		expect(blinkDelay(constant(1 - EPSILON))).toBeLessThanOrEqual(
			GAZE_BLINK_DELAY[1],
		)
	})
})
