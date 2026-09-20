"use client"

import { useLayoutEffect, useMemo, useRef } from "react"

import { VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"
import { onBotAvatarFrame } from "@workspace/ui/components/bot-avatar-clock"
import {
	type BotSealState,
	isSealAnimated,
	sealFrame,
} from "@workspace/ui/components/bot-seal-frame"
import { sealSolid } from "@workspace/ui/components/bot-seal-solid"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const SEAL_SIZE = 200
const RENDERED_WEIGHT = 1.25

const sealInk = (size: number) => (RENDERED_WEIGHT * VIEW_BOX) / size

type BotSealProps = {
	seed: string
	state?: BotSealState
	size?: number
	className?: string
}

const BotSeal = ({
	seed,
	state,
	size = SEAL_SIZE,
	className,
}: BotSealProps) => {
	const pathRef = useRef<SVGPathElement>(null)
	const solid = useMemo(() => sealSolid(seed), [seed])
	const still = useMemo(
		() => sealFrame({ solid, state, elapsed: 0 }),
		[solid, state],
	)
	const prefersReducedMotion = usePrefersReducedMotion()
	const isAnimated = isSealAnimated(state) && !prefersReducedMotion

	useLayoutEffect(() => {
		const apply = (path: string) => pathRef.current?.setAttribute("d", path)
		if (!isAnimated) {
			apply(still)
			return
		}
		const start = performance.now()
		return onBotAvatarFrame((now) =>
			apply(sealFrame({ solid, state, elapsed: now - start })),
		)
	}, [isAnimated, solid, state, still])

	return (
		<svg
			aria-label={`Companion seal${state ? `, ${state}` : ""}`}
			className={className}
			data-slot="bot-seal"
			height={size}
			role="img"
			viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
			width={size}
		>
			<path
				d={still}
				fill="none"
				ref={pathRef}
				stroke="currentColor"
				strokeLinecap="butt"
				strokeLinejoin="miter"
				strokeWidth={sealInk(size)}
			/>
		</svg>
	)
}

export { BotSeal, type BotSealProps }
