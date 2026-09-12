// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ANIMALS } from "@workspace/ui/components/bot-avatar-animals"
import {
	BotAvatarEngine,
	PARTS,
} from "@workspace/ui/components/bot-avatar-engine"
import { GAZE_YAW_LIMIT } from "@workspace/ui/components/bot-avatar-gaze"

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
const HEAD_DELAY_WINDOW_MS = 48
const AFTER_HEAD_DELAY_MS = 400
const PINNED_GAZE = { yaw: GAZE_YAW_LIMIT, pitch: 0 }

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

const mountRig = () => {
	document.body.innerHTML = RIG_MARKUP
	const svg = document.querySelector("svg") as unknown as SVGSVGElement
	const engine = new BotAvatarEngine(ANIMALS.rabbit)
	engine.bind(svg)
	engine.setState(RESTING_STATE)
	engine.setGaze(PINNED_GAZE)
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
	})

	it("darts the eyes home and only then turns the head after them", () => {
		const { engine, svg } = mountRig()
		advance(SETTLE_MS)
		const pinnedReach = eyeReach(svg)
		const pinnedLean = headLean(svg)

		engine.setGaze(null)
		advance(80)
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

	it("keeps the head turning when the state changes inside the head delay", () => {
		const { engine, svg } = mountRig()
		advance(SETTLE_MS)
		const pinnedLean = headLean(svg)

		engine.setGaze(null)
		advance(HEAD_DELAY_WINDOW_MS)
		engine.setState(GLANCING_STATE)
		advance(AFTER_HEAD_DELAY_MS)
		const followedLean = headLean(svg)
		engine.stop()

		expect(pinnedLean).toBeGreaterThan(0)
		expect(followedLean).toBeLessThan(pinnedLean)
	})
})
