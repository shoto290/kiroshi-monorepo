import { useEffect, useState } from "react"

import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

import { SCENE_COPY } from "./copy"

const CHARACTERS_PER_SECOND = 30

const typingMs = (text: string) => (text.length / CHARACTERS_PER_SECOND) * 1000

const ICHI_ANSWER_AT = 2400
const NI_ANSWER_AT = 6000
const MISSION_DELAY = 1000
const MISSION_AT = NI_ANSWER_AT + typingMs(SCENE_COPY.niAnswer) + MISSION_DELAY
const CLOSING_AT = 13000
const FADE_MS = 400
const LOOP_MS = CLOSING_AT + FADE_MS

const FROZEN_ELAPSED = [
	0,
	ICHI_ANSWER_AT + typingMs(SCENE_COPY.ichiAnswer),
	NI_ANSWER_AT + typingMs(SCENE_COPY.niAnswer),
	MISSION_AT,
	CLOSING_AT + FADE_MS / 2,
]

const FROZEN_STATE_PARAMETER = "state"

const typedCount = (text: string, sinceMs: number) =>
	Math.min(text.length, Math.floor((sinceMs * CHARACTERS_PER_SECOND) / 1000))

const fadeOutEndingAt = (elapsed: number, gone: number) => {
	const left = (gone - elapsed) / FADE_MS
	return left >= 1 ? 1 : Math.max(0, Math.round(left * 100)) / 100
}

type SceneFrame = {
	elapsedSeconds: number
	openingOpacity: number
	requestOpacity: number
	ichiTyped: number
	niTyped: number
	hasIchiAnswer: boolean
	hasNiAnswer: boolean
	hasMission: boolean
	closingOpacity: number
}

const frameAt = (elapsed: number): SceneFrame => {
	const hasIchiAnswer = elapsed >= ICHI_ANSWER_AT
	const hasNiAnswer = elapsed >= NI_ANSWER_AT

	return {
		elapsedSeconds: Math.floor(elapsed / 1000),
		openingOpacity: fadeOutEndingAt(elapsed, ICHI_ANSWER_AT),
		requestOpacity: fadeOutEndingAt(elapsed, MISSION_AT),
		ichiTyped: hasIchiAnswer
			? typedCount(SCENE_COPY.ichiAnswer, elapsed - ICHI_ANSWER_AT)
			: 0,
		niTyped: hasNiAnswer
			? typedCount(SCENE_COPY.niAnswer, elapsed - NI_ANSWER_AT)
			: 0,
		hasIchiAnswer,
		hasNiAnswer,
		hasMission: elapsed >= MISSION_AT,
		closingOpacity: fadeOutEndingAt(elapsed, LOOP_MS),
	}
}

const isSameFrame = (one: SceneFrame, other: SceneFrame) =>
	one.elapsedSeconds === other.elapsedSeconds &&
	one.openingOpacity === other.openingOpacity &&
	one.requestOpacity === other.requestOpacity &&
	one.ichiTyped === other.ichiTyped &&
	one.niTyped === other.niTyped &&
	one.hasIchiAnswer === other.hasIchiAnswer &&
	one.hasNiAnswer === other.hasNiAnswer &&
	one.hasMission === other.hasMission &&
	one.closingOpacity === other.closingOpacity

const frozenElapsed = () => {
	const asked = new URLSearchParams(window.location.search).get(
		FROZEN_STATE_PARAMETER,
	)
	if (asked === null) return null

	const rank = Number.parseInt(asked, 10)
	return FROZEN_ELAPSED[rank - 1] ?? null
}

type SceneTimeline = {
	frame: SceneFrame
	isStill: boolean
}

const stillTimeline = (elapsed: number): SceneTimeline => ({
	frame: frameAt(elapsed),
	isStill: true,
})

export const useSceneTimeline = (): SceneTimeline => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [frozenAt] = useState(frozenElapsed)
	const isStill = prefersReducedMotion || frozenAt !== null
	const stillAt = frozenAt ?? MISSION_AT
	const [timeline, setTimeline] = useState<SceneTimeline>(() =>
		stillTimeline(stillAt),
	)

	useEffect(() => {
		if (isStill) {
			setTimeline(stillTimeline(stillAt))
			return
		}

		let elapsed = 0
		let lastFrameAt = performance.now()
		let request = 0

		const advance = (now: number) => {
			elapsed = (elapsed + (now - lastFrameAt)) % LOOP_MS
			lastFrameAt = now

			const frame = frameAt(elapsed)
			setTimeline((current) =>
				isSameFrame(current.frame, frame) && !current.isStill
					? current
					: { frame, isStill: false },
			)
			request = requestAnimationFrame(advance)
		}

		const stop = () => {
			cancelAnimationFrame(request)
			request = 0
		}

		const resume = () => {
			lastFrameAt = performance.now()
			request = requestAnimationFrame(advance)
		}

		const onVisibilityChange = () => {
			if (document.hidden) stop()
			else if (request === 0) resume()
		}

		resume()
		document.addEventListener("visibilitychange", onVisibilityChange)

		return () => {
			stop()
			document.removeEventListener("visibilitychange", onVisibilityChange)
		}
	}, [isStill, stillAt])

	return timeline
}
