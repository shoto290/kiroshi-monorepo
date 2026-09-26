"use client"

import { useRef } from "react"

import {
	ASCII_GLYPH_SPACE,
	glyphCells,
} from "@workspace/ui/components/ascii-glyph-avatar"
import {
	companionSeed,
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	pickSilhouette,
	seededRandom,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useExplorationClock,
} from "@workspace/ui/components/avatar-exploration-frame"
import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

type DitherScreen = "weight" | "halftone" | "ordered" | "organic"

type DitheredFieldAvatarProps = ExplorationAvatarProps & {
	screen: DitherScreen
}

type DensityField = {
	cells: number
	silhouette: Float32Array
	lattice: Float32Array
}

type DrawCell = {
	context: CanvasRenderingContext2D
	x: number
	y: number
	cell: number
	density: number
}

const CELL_CSS = 3.2
const MIN_CELLS = 8
const MAX_CELLS = 30
const LATTICE = 5
const BLOB_SIGMA = 0.055
const COLUMN_STEP = 0.13
const ROW_STEP = 0.1
const FLOOR = 0.03
const NOISE_AMPLITUDE = 0.2
const SILHOUETTE_WEIGHT = 0.95
const DRIFT_PERIOD = 9000
const STATE_HOLD = 0.6
const HUE_SALT = 0x51ed270b
const HUE_JITTER = 12
const FIELD_LIGHTNESS = 0.5
const FIELD_CHROMA = 0.16
const INK = "oklch(1 0 0)"
const HALF_TONE_ALPHA = 0.45
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const TONES = [0, 0.5, 1]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const cellsFor = (size: number) =>
	Math.min(MAX_CELLS, Math.max(MIN_CELLS, Math.round(size / CELL_CSS)))

const surfaceOf = (seed: number, tint?: BotAvatarBlot) => {
	const random = seededRandom(seed ^ HUE_SALT)
	const jitter = Math.round((random() * 2 - 1) * HUE_JITTER)
	return tint
		? `oklch(from ${blotTint(tint)} ${FIELD_LIGHTNESS} ${FIELD_CHROMA} calc(h + ${jitter}))`
		: `oklch(${FIELD_LIGHTNESS} ${FIELD_CHROMA} ${Math.floor(random() * 360)})`
}

const densityField = (seed: number, cells: number): DensityField => {
	const glyph = glyphCells(pickSilhouette(seed, ASCII_GLYPH_SPACE)).map(
		({ column, row }) => ({
			x: 0.5 + (column - 2) * COLUMN_STEP,
			y: 0.5 + (row - 3) * ROW_STEP,
		}),
	)
	const silhouette = new Float32Array(cells * cells)
	for (let row = 0; row < cells; row++)
		for (let column = 0; column < cells; column++) {
			const u = (column + 0.5) / cells
			const v = (row + 0.5) / cells
			let sum = 0
			for (const blob of glyph)
				sum += Math.exp(
					-((u - blob.x) ** 2 + (v - blob.y) ** 2) / (2 * BLOB_SIGMA ** 2),
				)
			silhouette[row * cells + column] = clamp01(sum)
		}
	const random = seededRandom(seed)
	const lattice = Float32Array.from({ length: LATTICE * LATTICE }, random)
	return { cells, silhouette, lattice }
}

const smooth = (value: number) => value * value * (3 - 2 * value)

const noiseAt = (lattice: Float32Array, u: number, v: number) => {
	const x = (((u % 1) + 1) % 1) * LATTICE
	const y = (((v % 1) + 1) % 1) * LATTICE
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const at = (column: number, row: number) =>
		lattice[(row % LATTICE) * LATTICE + (column % LATTICE)]
	const fx = smooth(x - x0)
	const fy = smooth(y - y0)
	const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
	const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
	return top + (bottom - top) * fy
}

const densities = (
	{ cells, silhouette, lattice }: DensityField,
	state: ExplorationState,
	time: number,
) => {
	const drift = state === "idle" ? 0 : time / DRIFT_PERIOD
	return Array.from(silhouette, (shape, index) => {
		const u = ((index % cells) + 0.5) / cells
		const v = (Math.floor(index / cells) + 0.5) / cells
		const floor = FLOOR + NOISE_AMPLITUDE * noiseAt(lattice, u + drift, v)
		const hold =
			STATE_HOLD +
			(1 - STATE_HOLD) *
				fieldIntensity(state, { x: u * 2 - 1, y: v * 2 - 1 }, time)
		return clamp01((floor + SILHOUETTE_WEIGHT * shape) * hold)
	})
}

const square = ({ context, x, y, cell }: DrawCell, share: number) => {
	const side = cell * share
	context.fillRect(x + (cell - side) / 2, y + (cell - side) / 2, side, side)
}

const disc = ({ context, x, y, cell }: DrawCell, radius: number) => {
	context.beginPath()
	context.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2)
	context.fill()
}

const cross = ({ context, x, y, cell }: DrawCell) => {
	const inset = cell * 0.15
	context.lineWidth = cell * 0.16
	context.beginPath()
	context.moveTo(x + inset, y + inset)
	context.lineTo(x + cell - inset, y + cell - inset)
	context.moveTo(x + cell - inset, y + inset)
	context.lineTo(x + inset, y + cell - inset)
	context.stroke()
}

const drawWeight = (target: DrawCell) => {
	const { density, cell } = target
	if (density < 0.18) return
	if (density < 0.4) return disc(target, cell * 0.14)
	if (density < 0.6) return square(target, 0.42)
	if (density < 0.8) return cross(target)
	square(target, 0.92)
}

const drawHalftone = (target: DrawCell) => {
	const radius = (target.cell / 2) * Math.sqrt(target.density) * 1.08
	if (radius > target.cell * 0.06) disc(target, radius)
}

const bayerAt = (column: number, row: number) =>
	(BAYER[(row % 4) * 4 + (column % 4)] + 0.5) / BAYER.length

const organicTones = (field: number[], cells: number) => {
	const error = Float32Array.from(field)
	const tones = new Array<number>(field.length)
	for (let row = 0; row < cells; row++)
		for (let column = 0; column < cells; column++) {
			const index = row * cells + column
			const value = error[index]
			const tone = TONES.reduce((best, next) =>
				Math.abs(next - value) < Math.abs(best - value) ? next : best,
			)
			tones[index] = tone
			const spill = value - tone
			if (column + 1 < cells) error[index + 1] += (spill * 7) / 16
			if (row + 1 < cells) {
				if (column > 0) error[index + cells - 1] += (spill * 3) / 16
				error[index + cells] += (spill * 5) / 16
				if (column + 1 < cells) error[index + cells + 1] += spill / 16
			}
		}
	return tones
}

const paintScreen = (
	context: CanvasRenderingContext2D,
	screen: DitherScreen,
	field: number[],
	cells: number,
	side: number,
) => {
	const cell = side / cells
	const tones = screen === "organic" ? organicTones(field, cells) : []
	context.clearRect(0, 0, side, side)
	context.fillStyle = INK
	context.strokeStyle = INK
	for (const [index, density] of field.entries()) {
		const column = index % cells
		const row = Math.floor(index / cells)
		const target = { context, x: column * cell, y: row * cell, cell, density }
		if (screen === "weight") drawWeight(target)
		if (screen === "halftone") drawHalftone(target)
		if (screen === "ordered" && density > bayerAt(column, row))
			square(target, 0.72)
		if (screen === "organic" && tones[index] > 0) {
			context.globalAlpha = tones[index] === 1 ? 1 : HALF_TONE_ALPHA
			square(target, 0.9)
			context.globalAlpha = 1
		}
	}
}

const DitheredFieldAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
	screen,
}: DitheredFieldAvatarProps) => {
	const canvas = useRef<HTMLCanvasElement>(null)
	const prefersReducedMotion = usePrefersReducedMotion()
	const seed = companionSeed(name, tint)
	const field = densityField(seed, cellsFor(size))
	const drawnState = prefersReducedMotion ? "idle" : state

	useExplorationClock({
		state: drawnState,
		paint: (time) => {
			const element = canvas.current
			const context = element?.getContext("2d")
			if (!element || !context) return
			const side = Math.round(size * (window.devicePixelRatio || 1))
			if (element.width !== side) {
				element.width = side
				element.height = side
			}
			paintScreen(
				context,
				screen,
				densities(field, drawnState, time),
				field.cells,
				side,
			)
		},
	})

	return (
		<ExplorationFrame
			name={name}
			size={size}
			state={state}
			surface={surfaceOf(seed, tint)}
			tint={tint}
		>
			<canvas className="pointer-events-none size-full" ref={canvas} />
		</ExplorationFrame>
	)
}

export { DitheredFieldAvatar, type DitheredFieldAvatarProps, type DitherScreen }
