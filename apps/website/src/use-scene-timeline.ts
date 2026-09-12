import { useCallback, useEffect, useRef, useState } from "react"

import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const CHARACTERS_PER_SECOND = 30

const typingMs = (text: string) => (text.length / CHARACTERS_PER_SECOND) * 1000

const FIRST_ANSWER_AT = 2400
const SECOND_ANSWER_AT = 6000
const MISSION_DELAY = 1000
const IDLE_MS = 8000

const CLOSING_AT = 13000
const FADE_MS = 400
const LOOP_MS = CLOSING_AT + FADE_MS

const FROZEN_STATE_PARAMETER = "state"

type SceneAnswers = readonly [string, string]

const missionAtOf = (answers: SceneAnswers) =>
	SECOND_ANSWER_AT + typingMs(answers[1]) + MISSION_DELAY

const beatElapsed = (answers: SceneAnswers) => [
	0,
	FIRST_ANSWER_AT + typingMs(answers[0]),
	SECOND_ANSWER_AT + typingMs(answers[1]),
	missionAtOf(answers),
	CLOSING_AT + FADE_MS / 2,
]

const typedCount = (text: string, sinceMs: number) =>
	Math.min(text.length, Math.floor((sinceMs * CHARACTERS_PER_SECOND) / 1000))

const fadeOutEndingAt = (elapsed: number, gone: number) => {
	const left = (gone - elapsed) / FADE_MS
	return left >= 1 ? 1 : Math.max(0, Math.round(left * 100)) / 100
}

type SceneFrame = {
	elapsedSeconds: number
	requestOpacity: number
	firstAnswerOpacity: number
	firstTyped: number
	secondTyped: number
	hasFirstAnswer: boolean
	hasSecondAnswer: boolean
	hasMission: boolean
	closingOpacity: number
}

const frameAt = (elapsed: number, answers: SceneAnswers): SceneFrame => {
	const hasFirstAnswer = elapsed >= FIRST_ANSWER_AT
	const hasSecondAnswer = elapsed >= SECOND_ANSWER_AT

	return {
		elapsedSeconds: Math.floor(elapsed / 1000),
		requestOpacity: fadeOutEndingAt(elapsed, SECOND_ANSWER_AT),
		firstAnswerOpacity: fadeOutEndingAt(elapsed, missionAtOf(answers)),
		firstTyped: hasFirstAnswer
			? typedCount(answers[0], elapsed - FIRST_ANSWER_AT)
			: 0,
		secondTyped: hasSecondAnswer
			? typedCount(answers[1], elapsed - SECOND_ANSWER_AT)
			: 0,
		hasFirstAnswer,
		hasSecondAnswer,
		hasMission: elapsed >= missionAtOf(answers),
		closingOpacity: fadeOutEndingAt(elapsed, LOOP_MS),
	}
}

const isSameFrame = (one: SceneFrame, other: SceneFrame) =>
	one.elapsedSeconds === other.elapsedSeconds &&
	one.requestOpacity === other.requestOpacity &&
	one.firstAnswerOpacity === other.firstAnswerOpacity &&
	one.firstTyped === other.firstTyped &&
	one.secondTyped === other.secondTyped &&
	one.hasFirstAnswer === other.hasFirstAnswer &&
	one.hasSecondAnswer === other.hasSecondAnswer &&
	one.hasMission === other.hasMission &&
	one.closingOpacity === other.closingOpacity

const frozenBeat = () => {
	const asked = new URLSearchParams(window.location.search).get(
		FROZEN_STATE_PARAMETER,
	)
	if (asked === null) return null

	const rank = Number.parseInt(asked, 10)
	return rank >= 1 && rank <= 5 ? rank : null
}

type SceneTimeline = {
	frame: SceneFrame
	isStill: boolean
	engage: () => void
}

type SceneTimelineState = Omit<SceneTimeline, "engage">

const stillTimeline = (
	elapsed: number,
	answers: SceneAnswers,
): SceneTimelineState => ({
	frame: frameAt(elapsed, answers),
	isStill: true,
})

type SceneTimelineInput = {
	answers: SceneAnswers
	onIdle: () => void
}

export const useSceneTimeline = ({
	answers,
	onIdle,
}: SceneTimelineInput): SceneTimeline => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [beat] = useState(frozenBeat)
	const [isEngaged, setIsEngaged] = useState(false)
	const idleRef = useRef<number | undefined>(undefined)
	const onIdleRef = useRef(onIdle)
	const isStill = prefersReducedMotion || beat !== null
	const stillAt =
		beat === null ? missionAtOf(answers) : beatElapsed(answers)[beat - 1]
	const [timeline, setTimeline] = useState<SceneTimelineState>(() =>
		stillTimeline(stillAt, answers),
	)

	onIdleRef.current = onIdle

	const engage = useCallback(() => {
		setIsEngaged(true)
		window.clearTimeout(idleRef.current)
		idleRef.current = window.setTimeout(() => {
			setIsEngaged(false)
			onIdleRef.current()
		}, IDLE_MS)
	}, [])

	useEffect(() => () => window.clearTimeout(idleRef.current), [])

	useEffect(() => {
		if (isEngaged) return

		if (isStill) {
			setTimeline(stillTimeline(stillAt, answers))
			return
		}

		let elapsed = 0
		let lastFrameAt = performance.now()
		let request = 0

		const advance = (now: number) => {
			elapsed = (elapsed + (now - lastFrameAt)) % LOOP_MS
			lastFrameAt = now

			const frame = frameAt(elapsed, answers)
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
	}, [answers, isEngaged, isStill, stillAt])

	return { ...timeline, engage }
}

export type { SceneAnswers, SceneFrame }
