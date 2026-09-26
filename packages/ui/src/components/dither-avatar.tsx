"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
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
const LIGHT_ANGLES = 16
const LIGHT_POLARS = [80, 65, 50, 35]
const AMBIENT = 0.15
const SCALES = [1, 0.8]
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
]

const DITHER_SPACE = { families: SOLIDS.length, variants: 256 }

const cellCenter = (index: number) => ((index + 0.5) / GRID) * 2 - 1

const lightOf = (variant: number): Vector => {
	const azimuth = ((variant % LIGHT_ANGLES) / LIGHT_ANGLES) * TURN
	const polar =
		LIGHT_POLARS[Math.floor(variant / LIGHT_ANGLES) % LIGHT_POLARS.length] *
		DEGREE
	return [
		Math.sin(polar) * Math.cos(azimuth),
		Math.sin(polar) * Math.sin(azimuth),
		Math.cos(polar),
	]
}

const shadedPixels = ({ family, variant }: Silhouette): ShadedPixel[] => {
	const solid = SOLIDS[family]
	const [lx, ly, lz] = lightOf(variant)
	const scale = SCALES[Math.floor(variant / 64) % SCALES.length]
	const hasRim = Math.floor(variant / 128) % 2 === 1
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

export { DITHER_SPACE, DitherAvatar, shadedPixels }
