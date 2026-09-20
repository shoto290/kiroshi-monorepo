"use client"

import { type CSSProperties, useId } from "react"

import { round2, VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"

const MARBLE_BOX = 80
const MARBLE_SCALE = VIEW_BOX / MARBLE_BOX
const MARBLE_CENTER = MARBLE_BOX / 2
const MARBLE_BLUR = 7
const MARBLE_SHADE_COUNT = 3

const MARBLE_MIDDLE_PATH =
	"M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"

const MARBLE_TOP_PATH =
	"M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"

const MARBLE_SHADES = ["100%", "90%", "78%"] as const

const marbleShade = (tint: string, shade: number) =>
	`color-mix(in oklab, ${tint} ${MARBLE_SHADES[shade]}, var(--bot-blot-ink))`

const shadeProps = (tint: string, shade: number, blend?: CSSProperties) => ({
	fill: tint,
	style: { ...blend, fill: marbleShade(tint, shade) },
})

const seedHash = (seed: string) => {
	let hash = 0
	for (let at = 0; at < seed.length; at += 1) {
		hash = ((hash << 5) - hash + seed.charCodeAt(at)) | 0
	}
	return Math.abs(hash)
}

const digitAt = (value: number, place: number) =>
	Math.floor(value / 10 ** place) % 10

const unitOf = (value: number, range: number, place?: number) => {
	const unit = value % range
	return place !== undefined && digitAt(value, place) % 2 === 0 ? -unit : unit
}

type MarbleLayer = {
	shade: number
	translateX: number
	translateY: number
	rotate: number
	scale: number
}

const marbleLayer = (hash: number, at: number): MarbleLayer => {
	const spread = hash * (at + 1)
	return {
		shade: (hash + at) % MARBLE_SHADE_COUNT,
		translateX: unitOf(spread, MARBLE_BOX / 10, 1),
		translateY: unitOf(spread, MARBLE_BOX / 10, 2),
		rotate: unitOf(spread, 360, 1),
		scale: round2(1.2 + unitOf(spread, MARBLE_BOX / 20) / 10),
	}
}

const marbleLayers = (seed = ""): [MarbleLayer, MarbleLayer, MarbleLayer] => {
	const hash = seedHash(seed)
	return [marbleLayer(hash, 0), marbleLayer(hash, 1), marbleLayer(hash, 2)]
}

const marbleTransform = ({
	translateX,
	translateY,
	rotate,
	scale,
}: MarbleLayer) =>
	`translate(${translateX} ${translateY}) rotate(${rotate} ${MARBLE_CENTER} ${MARBLE_CENTER}) scale(${scale})`

const ISOLATED_STYLE = { isolation: "isolate" } as CSSProperties

const OVERLAY_STYLE = { mixBlendMode: "overlay" } as CSSProperties

const BLUR_BOUNDS = {
	x: -MARBLE_BOX,
	y: -MARBLE_BOX,
	width: MARBLE_BOX * 3,
	height: MARBLE_BOX * 3,
} as const

const MASK_BOUNDS = {
	x: 0,
	y: 0,
	width: VIEW_BOX,
	height: VIEW_BOX,
} as const

type BotAvatarMarbleProps = {
	radius: number
	seed?: string
	tint: string
}

const BotAvatarMarble = ({ radius, seed, tint }: BotAvatarMarbleProps) => {
	const id = useId()
	const blurId = `bot-avatar-marble-blur-${id}`
	const maskId = `bot-avatar-marble-mask-${id}`
	const [base, middle, top] = marbleLayers(seed)

	return (
		<>
			<defs>
				<filter filterUnits="userSpaceOnUse" id={blurId} {...BLUR_BOUNDS}>
					<feGaussianBlur stdDeviation={MARBLE_BLUR} />
				</filter>
				<mask id={maskId} maskUnits="userSpaceOnUse" {...MASK_BOUNDS}>
					<rect fill="white" rx={radius} {...MASK_BOUNDS} />
				</mask>
			</defs>
			<g
				data-slot="bot-avatar-marble"
				mask={`url(#${maskId})`}
				style={ISOLATED_STYLE}
			>
				<g transform={`scale(${MARBLE_SCALE})`}>
					<rect
						height={MARBLE_BOX}
						width={MARBLE_BOX}
						{...shadeProps(tint, base.shade)}
					/>
					<path
						d={MARBLE_MIDDLE_PATH}
						filter={`url(#${blurId})`}
						transform={marbleTransform(middle)}
						{...shadeProps(tint, middle.shade)}
					/>
					<path
						d={MARBLE_TOP_PATH}
						filter={`url(#${blurId})`}
						transform={marbleTransform(top)}
						{...shadeProps(tint, top.shade, OVERLAY_STYLE)}
					/>
				</g>
			</g>
		</>
	)
}

export { BotAvatarMarble, seedHash }
