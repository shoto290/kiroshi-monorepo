"use client"

import { useId, useMemo, useRef } from "react"

import { round2, VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"
import {
	ANIMALS,
	type BotAvatarAnimal,
} from "@workspace/ui/components/bot-avatar-animals"
import { useBotAvatarBinding } from "@workspace/ui/components/bot-avatar-binding"
import { BotAvatarBody } from "@workspace/ui/components/bot-avatar-body"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import { useBotAvatarDrag } from "@workspace/ui/components/bot-avatar-drag"
import type { BotAvatarOrientation } from "@workspace/ui/components/bot-avatar-engine"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

type BotAvatarInk = "regular" | "bold" | "heavy"

const INK_WEIGHTS: Record<BotAvatarInk, number> = {
	regular: 5.5,
	bold: 7.5,
	heavy: 9.25,
}

const REFERENCE_SIZE = 240
const MIN_RENDERED_WEIGHT = 1.25
const BOIL_DISPLACEMENT = 10

type InkWeight = { ink: BotAvatarInk; size: number }

const inkWeight = ({ ink, size }: InkWeight) =>
	Math.max(INK_WEIGHTS[ink], (MIN_RENDERED_WEIGHT * REFERENCE_SIZE) / size)

const BLOT_TINTS = [
	"red",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"orange",
] as const

type BotAvatarBlot = (typeof BLOT_TINTS)[number]

const blotTint = (blot: BotAvatarBlot) => `var(--bot-blot-${blot})`

type BotAvatarProps = {
	animal?: BotAvatarAnimal
	state?: BotAvatarState
	size?: number
	animated?: boolean
	yaw?: number
	pitch?: number
	roll?: number
	gazeYaw?: number
	gazePitch?: number
	perspective?: number
	ink?: BotAvatarInk
	blot?: BotAvatarBlot
	seed?: string
	interactive?: boolean
	wireframe?: boolean
	onOrientationChange?: (orientation: BotAvatarOrientation) => void
	className?: string
}

function BotAvatar({
	animal = "rabbit",
	state = "waiting",
	size = 240,
	animated = true,
	yaw,
	pitch,
	roll,
	gazeYaw,
	gazePitch,
	perspective = 0.55,
	ink = "bold",
	blot,
	seed,
	interactive = false,
	wireframe = false,
	onOrientationChange,
	className,
}: BotAvatarProps) {
	const svgRef = useRef<SVGSVGElement>(null)
	const id = useId()
	const filterId = `bot-avatar-sketch-${id}`
	const clipId = `bot-avatar-clip-${id}`
	const splitId = `bot-avatar-split-${id}`
	const headPathId = `bot-avatar-head-${id}`
	const headMaskId = `bot-avatar-head-mask-${id}`
	const definition = ANIMALS[animal]
	const weight = inkWeight({ ink, size })
	const boil = round2((BOIL_DISPLACEMENT * INK_WEIGHTS[ink]) / weight)
	const prefersReducedMotion = usePrefersReducedMotion()
	const isAnimated = animated && !prefersReducedMotion

	useBotAvatarBinding({
		definition,
		gazePitch,
		gazeYaw,
		isAnimated,
		perspective,
		pitch,
		roll,
		state,
		svgRef,
		wireframe,
		yaw,
	})

	const { startDrag, moveDrag, endDrag } = useBotAvatarDrag({
		interactive,
		onOrientationChange,
		pitch,
		roll,
		yaw,
	})

	const body = useMemo(
		() => (
			<BotAvatarBody
				animal={animal}
				blotFill={blot ? blotTint(blot) : undefined}
				boil={boil}
				clipId={clipId}
				definition={definition}
				filterId={filterId}
				headMaskId={headMaskId}
				headPathId={headPathId}
				seed={seed}
				splitId={splitId}
				weight={weight}
				wireframe={wireframe}
			/>
		),
		[
			animal,
			blot,
			boil,
			clipId,
			definition,
			filterId,
			headMaskId,
			headPathId,
			seed,
			splitId,
			weight,
			wireframe,
		],
	)

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
			width={size}
			height={size}
			role="img"
			aria-label={`Companion avatar ${animal}, ${state}`}
			onPointerDown={startDrag}
			onPointerMove={moveDrag}
			onPointerUp={endDrag}
			className={cn(
				blot ? "on-bot-blot" : "text-foreground",
				interactive && "cursor-grab touch-none active:cursor-grabbing",
				className,
			)}
		>
			{body}
		</svg>
	)
}

export {
	BLOT_TINTS,
	BotAvatar,
	type BotAvatarBlot,
	type BotAvatarInk,
	type BotAvatarOrientation,
	type BotAvatarProps,
	blotTint,
}
