"use client"

import {
	type BotAvatarShading,
	BotAvatar as BotAvatarShape,
	type BotAvatarState,
	type BotAvatarType,
} from "bot-avatars"

import {
	BLOT_TINTS,
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { hash } from "@workspace/ui/components/bot-avatar-blot"
import { cn } from "@workspace/ui/lib/utils"

const ABSTRACT_SHAPES = [
	"circle",
	"blob",
	"drop",
	"pebble",
	"puddle",
	"pill",
	"cloud",
	"star",
	"hexagon",
] as const satisfies readonly BotAvatarType[]

const CHARACTER_SHAPES = [
	"cat",
	"droid",
	"alien",
	"mech",
	"ghost",
	"clover",
	"flower",
] as const satisfies readonly BotAvatarType[]

const SHAPE_SCALE = 0.7
const CORNER_SCALE = 0.25
const BLINK_PHASES = 1000

type BotTileVariant = "neutral" | "tinted"

const VARIANT_CLASSES: Record<BotTileVariant, string> = {
	neutral: "bg-muted",
	tinted: "bg-[color-mix(in_oklab,var(--bot-tile-blot)_35%,var(--background))]",
}

type SeededPick = { seed: string; includeCharacters: boolean }

const seededShape = ({ seed, includeCharacters }: SeededPick) => {
	const pool: readonly BotAvatarType[] = includeCharacters
		? [...ABSTRACT_SHAPES, ...CHARACTER_SHAPES]
		: ABSTRACT_SHAPES
	return pool[hash(seed) % pool.length]
}

const seededBlot = (seed: string) =>
	BLOT_TINTS[hash(`${seed}:blot`) % BLOT_TINTS.length]

const blotColor = (blot: BotAvatarBlot) =>
	getComputedStyle(document.documentElement)
		.getPropertyValue(`--bot-blot-${blot}`)
		.trim()

type BotTileProps = {
	seed: string
	shape?: BotAvatarType
	includeCharacters?: boolean
	blot?: BotAvatarBlot
	size?: number
	state?: BotAvatarState
	shading?: BotAvatarShading
	variant?: BotTileVariant
	className?: string
}

const BotTile = ({
	seed,
	shape,
	includeCharacters = false,
	blot,
	size = 40,
	state = "default",
	shading = "flat",
	variant = "neutral",
	className,
}: BotTileProps) => {
	const resolvedBlot = blot ?? seededBlot(seed)
	return (
		<div
			data-slot="bot-tile"
			data-variant={variant}
			className={cn(
				"grid shrink-0 place-items-center",
				VARIANT_CLASSES[variant],
				className,
			)}
			style={{
				width: size,
				height: size,
				borderRadius: size * CORNER_SCALE,
				["--bot-tile-blot" as string]: blotTint(resolvedBlot),
			}}
		>
			<BotAvatarShape
				type={shape ?? seededShape({ seed, includeCharacters })}
				color={blotColor(resolvedBlot)}
				saturation={1}
				seed={(hash(seed) % BLINK_PHASES) / BLINK_PHASES}
				size={Math.round(size * SHAPE_SCALE)}
				state={state}
				shading={shading}
				paused={state !== "working"}
				interactive={false}
			/>
		</div>
	)
}

export {
	ABSTRACT_SHAPES,
	BotTile,
	type BotTileProps,
	type BotTileVariant,
	CHARACTER_SHAPES,
	seededBlot,
}
