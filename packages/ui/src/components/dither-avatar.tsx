"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	stepCount,
	variantSteps,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useExplorationClock,
} from "@workspace/ui/components/avatar-exploration-frame"

type Vector = [number, number, number]

type Solid = (u: number, v: number) => Vector | null

type ShadedPixel = {
	column: number
	row: number
	x: number
	y: number
	shade: number
}

const GRID = 16
const TURN = Math.PI * 2
const DEGREE = Math.PI / 180
const COMPASS = 8
const LIGHT_POLARS = [75, 40]
const AMBIENT = 0.15
const SCALES = [1, 0.72]
const FIELD_HOLD = 0.45
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const TAN_30 = Math.tan(30 * DEGREE)

const normalize = ([x, y, z]: Vector): Vector => {
	const length = Math.hypot(x, y, z)
	return [x / length, y / length, z / length]
}

const facing = (x: number, y: number): Vector => [
	x,
	y,
	Math.sqrt(Math.max(0, 1 - x * x - y * y)),
]

const CYLINDER_CAP = normalize([0, -0.9, 0.45])

const CUBE_FACES = {
	top: normalize([0, -0.8, 0.6]),
	left: normalize([-0.7, 0.35, 0.62]),
	right: normalize([0.7, 0.35, 0.62]),
}

const SOLIDS: Solid[] = [
	(u, v) => {
		const radius = 0.82
		return Math.hypot(u, v) > radius ? null : facing(u / radius, v / radius)
	},
	(u, v) => {
		const distance = Math.hypot(u, v)
		const bend = (distance - 0.55) / 0.27
		if (Math.abs(bend) > 1) return null
		return facing((bend * u) / distance, (bend * v) / distance)
	},
	(u, v) => {
		if (Math.abs(u) > 0.69 || Math.abs(v) + Math.abs(u) * TAN_30 > 0.8)
			return null
		if (v <= -Math.abs(u) * TAN_30) return CUBE_FACES.top
		return u < 0 ? CUBE_FACES.left : CUBE_FACES.right
	},
	(u, v) => {
		const radius = 0.42
		const dy = v - Math.max(-0.4, Math.min(0.4, v))
		return Math.hypot(u, dy) > radius ? null : facing(u / radius, dy / radius)
	},
	(u, v) => {
		const halfWidth = ((v + 0.8) / 1.5) * 0.7
		if (v > 0.7 || Math.abs(u) > halfWidth) return null
		return normalize([(u / Math.max(halfWidth, 0.01)) * 0.8, -0.35, 0.5])
	},
	(u, v) => {
		if (Math.abs(u) > 0.5 || v > 0.6) return null
		if (Math.hypot(u / 0.5, (v + 0.55) / 0.2) <= 1) return CYLINDER_CAP
		return v < -0.55 ? null : facing(u / 0.5, 0)
	},
	(u, v) => {
		if (Math.abs(u) / 0.7 + Math.abs(v) / 0.85 > 1) return null
		return normalize([Math.sign(u) * 0.6, Math.sign(v) * 0.5, 0.62])
	},
	(u, v) => {
		const radius = 0.8
		const dy = v - 0.35
		if (dy > 0 || Math.hypot(u, dy) > radius) return null
		return facing(u / radius, dy / radius)
	},
]

const DITHER_STEPS = [COMPASS, LIGHT_POLARS.length, SCALES.length, 2] as const

const DITHER_SPACE = {
	families: SOLIDS.length,
	variants: stepCount(DITHER_STEPS),
}

const ditherKey = ({ family, variant }: Silhouette) =>
	[family, ...variantSteps(variant, DITHER_STEPS)].join(".")

const cellCenter = (index: number) => ((index + 0.5) / GRID) * 2 - 1

const lightOf = (compass: number, polarStep: number): Vector => {
	const azimuth = (compass / COMPASS) * TURN
	const polar = LIGHT_POLARS[polarStep] * DEGREE
	return [
		Math.sin(polar) * Math.cos(azimuth),
		Math.sin(polar) * Math.sin(azimuth),
		Math.cos(polar),
	]
}

const shadedPixels = ({ family, variant }: Silhouette): ShadedPixel[] => {
	const solid = SOLIDS[family]
	const [compass, polarStep, scaleStep, rimStep] = variantSteps(
		variant,
		DITHER_STEPS,
	)
	const [lx, ly, lz] = lightOf(compass, polarStep)
	const scale = SCALES[scaleStep]
	const hasRim = rimStep === 1
	const normalAt = (column: number, row: number) =>
		solid(cellCenter(column) / scale, cellCenter(row) / scale)
	const isEdge = (column: number, row: number) =>
		[
			[column - 1, row],
			[column + 1, row],
			[column, row - 1],
			[column, row + 1],
		].some(
			([neighbourColumn, neighbourRow]) =>
				!normalAt(neighbourColumn, neighbourRow),
		)

	const pixels: ShadedPixel[] = []
	for (let row = 0; row < GRID; row++)
		for (let column = 0; column < GRID; column++) {
			const normal = normalAt(column, row)
			if (!normal) continue
			const lambert = Math.max(
				0,
				normal[0] * lx + normal[1] * ly + normal[2] * lz,
			)
			const shade =
				hasRim && isEdge(column, row) ? 1 : AMBIENT + (1 - AMBIENT) * lambert
			pixels.push({
				column,
				row,
				x: cellCenter(column),
				y: cellCenter(row),
				shade,
			})
		}
	return pixels
}

const isInked = (pixel: ShadedPixel, state: ExplorationState, time: number) =>
	pixel.shade *
		(FIELD_HOLD + (1 - FIELD_HOLD) * fieldIntensity(state, pixel, time)) >
	(BAYER[(pixel.row % 4) * 4 + (pixel.column % 4)] + 0.5) / BAYER.length

const DitherAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
}: ExplorationAvatarProps) => {
	const canvas = useRef<HTMLCanvasElement>(null)
	const pixels = shadedPixels(
		pickSilhouette(companionSeed(name, tint), DITHER_SPACE),
	)

	useExplorationClock({
		state,
		paint: (time) => {
			const element = canvas.current
			const context = element?.getContext("2d")
			if (!element || !context) return
			context.clearRect(0, 0, GRID, GRID)
			context.fillStyle = getComputedStyle(element).color
			for (const pixel of pixels)
				if (isInked(pixel, state, time))
					context.fillRect(pixel.column, pixel.row, 1, 1)
		},
	})

	return (
		<ExplorationFrame name={name} size={size} state={state} tint={tint}>
			<canvas
				className="pointer-events-none size-full [image-rendering:pixelated]"
				height={GRID}
				ref={canvas}
				width={GRID}
			/>
		</ExplorationFrame>
	)
}

export { DITHER_SPACE, DitherAvatar, ditherKey, shadedPixels }
