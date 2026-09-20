"use client"

import { useLayoutEffect, useMemo, useRef } from "react"

import { BLOT_TINTS, blotTint } from "@workspace/ui/components/bot-avatar"
import { VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"
import { hashSeed } from "@workspace/ui/components/bot-avatar-blot"
import { onBotAvatarFrame } from "@workspace/ui/components/bot-avatar-clock"
import {
	type BotSealState,
	isSealAnimated,
	type SealFrame,
	sealFrame,
} from "@workspace/ui/components/bot-seal-frame"
import { sealSolid } from "@workspace/ui/components/bot-seal-solid"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const SEAL_SIZE = 200
const SEAL_INK = 2.5
const MIN_RENDERED_WEIGHT = 1
const DIM_INK = "var(--muted-foreground)"
const ATTENTION_INK = "var(--bot-badge-attention)"

const sealInk = (size: number) =>
	Math.max(SEAL_INK, (MIN_RENDERED_WEIGHT * VIEW_BOX) / size)

const sealTint = (seed: string, state?: BotSealState) =>
	state === "waiting"
		? ATTENTION_INK
		: blotTint(BLOT_TINTS[hashSeed(seed) % BLOT_TINTS.length])

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
	const litRef = useRef<SVGPathElement>(null)
	const dimRef = useRef<SVGPathElement>(null)
	const solid = useMemo(() => sealSolid(seed), [seed])
	const still = useMemo(
		() => sealFrame({ solid, state, elapsed: 0 }),
		[solid, state],
	)
	const prefersReducedMotion = usePrefersReducedMotion()
	const isAnimated = isSealAnimated(state) && !prefersReducedMotion

	useLayoutEffect(() => {
		const apply = ({ lit, dim }: SealFrame) => {
			litRef.current?.setAttribute("d", lit)
			dimRef.current?.setAttribute("d", dim)
		}
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
			aria-label={`Companion seal ${seed}${state ? `, ${state}` : ""}`}
			className={className}
			data-slot="bot-seal"
			height={size}
			role="img"
			viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
			width={size}
		>
			<g
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sealInk(size)}
			>
				<path
					d={still.dim}
					data-slot="bot-seal-dim"
					ref={dimRef}
					stroke={DIM_INK}
				/>
				<path
					d={still.lit}
					data-slot="bot-seal-lit"
					ref={litRef}
					stroke={sealTint(seed, state)}
				/>
			</g>
		</svg>
	)
}

export { BotSeal, type BotSealProps }
