// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ANIMALS } from "@workspace/ui/components/bot-avatar-animals"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import {
	BotAvatarEngine,
	PARTS,
} from "@workspace/ui/components/bot-avatar-engine"
import type { BotAvatarGaze } from "@workspace/ui/components/bot-avatar-gaze"
import {
	GAZE_DART_DURATION,
	GAZE_HEAD_DELAY,
	GAZE_YAW_LIMIT,
} from "@workspace/ui/components/bot-avatar-gaze"

const RIG_MARKUP = `
<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
	<g data-part="${PARTS.rig}">
		<g data-part="${PARTS.head}"></g>
		<path data-part="${PARTS.eye0}"></path>
		<path data-part="${PARTS.eye1}"></path>
		<g data-part="${PARTS.blush}"><ellipse></ellipse><ellipse></ellipse></g>
	</g>
</svg>
`

const RESTING_STATE = "listening"
const GLANCING_STATE = "thinking"
const SETTLE_MS = 2000
const INSIDE_HEAD_DELAY_MS = GAZE_HEAD_DELAY / 2
const AFTER_HEAD_DELAY_MS = 400
const PINNED_GAZE = { yaw: GAZE_YAW_LIMIT, pitch: 0 }
const HALFWAY_DRAW = 0.5
const BEFORE_GLANCE_MS = 400
const PAST_GLANCE_MS = 1600

const numbersIn = (value: string) =>
	(value.match(/-?\d*\.?\d+/g) ?? []).map(Number)

const eyeReach = (svg: SVGSVGElement) => {
	const points = numbersIn(
		svg.querySelector(`[data-part="${PARTS.eye0}"]`)?.getAttribute("d") ?? "",
	)
	const columns = points.filter((_, index) => index % 2 === 0)
	return columns.reduce((sum, x) => sum + x, 0) / columns.length
}

const headLean = (svg: SVGSVGElement) =>
	numbersIn(
		svg
			.querySelector(`[data-part="${PARTS.rig}"]`)
			?.getAttribute("transform") ?? "",
	)[0]

type MountedRig = {
	state?: BotAvatarState
	pin?: BotAvatarGaze | null
}

const mountRig = ({
	state = RESTING_STATE,
	pin = PINNED_GAZE,
}: MountedRig = {}) => {
	document.body.innerHTML = RIG_MARKUP
	const svg = document.querySelector("svg") as unknown as SVGSVGElement
	const engine = new BotAvatarEngine(ANIMALS.rabbit)
	engine.bind(svg)
	engine.setState(state)
	engine.setGaze(pin)
	engine.start()
	return { engine, svg }
}

const advance = (ms: number) => vi.advanceTimersByTime(ms)

describe("the gaze layer on a running engine", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		document.body.innerHTML = ""
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("darts the eyes home and only then turns the head after them", () => {
		const { engine, svg } = mountRig()
		advance(SETTLE_MS)
		const pinnedReach = eyeReach(svg)
		const pinnedLean = headLean(svg)

		engine.setGaze(null)
		advance(GAZE_DART_DURATION)
		const dartedReach = eyeReach(svg)
		const dartedLean = headLean(svg)

		advance(AFTER_HEAD_DELAY_MS)
		const followedLean = headLean(svg)
		engine.stop()

		expect(pinnedLean).toBeGreaterThan(0)
		expect(dartedReach).toBeLessThan(pinnedReach)
		expect(dartedLean).toBe(pinnedLean)
		expect(followedLean).toBeLessThan(pinnedLean)
		expect(Math.abs(followedLean - pinnedLean)).toBeLessThan(
			Math.abs(dartedReach - pinnedReach),
		)
	})

	it("holds a pinned gaze through a glance scheduled before the pin", () => {
		vi.spyOn(Math, "random").mockReturnValue(HALFWAY_DRAW)
		const { engine, svg } = mountRig({ state: GLANCING_STATE, pin: null })
		advance(BEFORE_GLANCE_MS)
		const centredReach = eyeReach(svg)

		engine.setGaze(PINNED_GAZE)
		advance(BEFORE_GLANCE_MS)
		const pinnedReach = eyeReach(svg)
		const pinnedLean = headLean(svg)

		advance(PAST_GLANCE_MS)
		const heldReach = eyeReach(svg)
		const heldLean = headLean(svg)
		engine.stop()

		expect(heldLean).toBe(pinnedLean)
		expect(Math.abs(heldReach - pinnedReach)).toBeLessThan(
			Math.abs(pinnedReach - centredReach) / 4,
		)
	})

	it("keeps the head turning when the state changes inside the head delay", () => {
		const { engine, svg } = mountRig()
		advance(SETTLE_MS)
		const pinnedLean = headLean(svg)

		engine.setGaze(null)
		advance(INSIDE_HEAD_DELAY_MS)
		engine.setState(GLANCING_STATE)
		advance(AFTER_HEAD_DELAY_MS)
		const followedLean = headLean(svg)
		engine.stop()

		expect(pinnedLean).toBeGreaterThan(0)
		expect(followedLean).toBeLessThan(pinnedLean)
	})
})
