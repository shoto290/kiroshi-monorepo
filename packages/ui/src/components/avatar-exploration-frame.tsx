"use client"

import { type ReactNode, type RefObject, useEffect, useRef } from "react"

import {
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	stillTime,
} from "@workspace/ui/components/avatar-exploration"
import { blotTint } from "@workspace/ui/components/bot-avatar"
import { companionPictureRadius } from "@workspace/ui/components/bot-identity-avatar"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

type Paint = (time: number) => void

type ExplorationFrameProps = Required<ExplorationAvatarProps> & {
	children: ReactNode
}

type ExplorationClock = { state: ExplorationState; paint: Paint }

type FieldOpacity = {
	state: ExplorationState
	root: RefObject<SVGSVGElement | null>
}

const painters = new Set<Paint>()
let frame = 0

const tick = (now: number) => {
	for (const paint of painters) paint(now)
	frame = painters.size > 0 ? requestAnimationFrame(tick) : 0
}

const subscribe = (paint: Paint) => {
	painters.add(paint)
	if (frame === 0) frame = requestAnimationFrame(tick)
	return () => {
		painters.delete(paint)
	}
}

const ExplorationFrame = ({
	name,
	tint,
	state,
	size,
	children,
}: ExplorationFrameProps) => (
	<span
		aria-label={name}
		className="relative inline-flex shrink-0 overflow-hidden text-(--bot-blot-ink)"
		data-slot="avatar-exploration"
		data-state={state}
		role="img"
		style={{
			width: size,
			height: size,
			borderRadius: companionPictureRadius(size),
			backgroundColor: blotTint(tint),
		}}
	>
		{children}
	</span>
)

const useExplorationClock = ({ state, paint }: ExplorationClock) => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const isAnimated = state !== "idle" && !prefersReducedMotion
	const latestPaint = useRef(paint)
	latestPaint.current = paint

	useEffect(() => {
		if (isAnimated) return subscribe((time) => latestPaint.current(time))
	}, [isAnimated])

	useEffect(() => {
		if (!isAnimated) latestPaint.current(stillTime(state))
	})
}

const readField = (element: SVGElement) => ({
	element,
	point: {
		x: Number(element.dataset.x),
		y: Number(element.dataset.y),
	},
})

const useFieldOpacity = ({ state, root }: FieldOpacity) => {
	useExplorationClock({
		state,
		paint: (time) => {
			const cells = root.current?.querySelectorAll<SVGElement>("[data-x]")
			for (const { element, point } of Array.from(cells ?? [], readField))
				element.style.opacity = String(fieldIntensity(state, point, time))
		},
	})
}

export { ExplorationFrame, useExplorationClock, useFieldOpacity }
