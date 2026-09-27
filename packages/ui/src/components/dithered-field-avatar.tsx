"use client"

import { useRef } from "react"

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
} from "@workspace/ui/components/companion-colour"
import {
	COMPANION_SILHOUETTE_SPACE,
	silhouetteCells,
} from "@workspace/ui/components/companion-silhouette"
import {
	type FieldGrid,
	type FieldPoint,
	hexagonCorners,
	honeycombGrid,
} from "@workspace/ui/components/field-grid"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

type FieldInk = "companion" | "foreground"

type DitheredFieldAvatarProps = ExplorationAvatarProps & {
	hasGround?: boolean
	ink?: FieldInk
}

type DensityField = {
	grid: FieldGrid
	silhouette: Float32Array
	lattice: Float32Array
	mask?: Uint8Array
}

type DitheredFieldProps = {
	name: string
	state: ExplorationState
	size: number
	field: DensityField
	ink: string
	surface?: string
	tint?: BotAvatarBlot
}

const FIELD_CELLS = 16
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
const SURFACE_LIGHTNESS = 0.96
const SURFACE_CHROMA_SHARE = 0.15
const CELL_SHARE = 0.9
const TONES = [0, 0.5, 1]
const HALF_TONE_ALPHA = 0.45
const TONE_ALPHAS = [
	[0.5, HALF_TONE_ALPHA],
	[1, 1],
] as const
const DITHER_SCREEN = "square-tone"
const FOREGROUND_INK = "var(--foreground)"

const COMPANION_GRID = honeycombGrid(FIELD_CELLS, CELL_SHARE)

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const inkOf = (seed: number, tint?: BotAvatarBlot) => {
	const random = seededRandom(seed ^ HUE_SALT)
	const jitter = Math.round((random() * 2 - 1) * HUE_JITTER)
	return tint
		? `oklch(from ${blotTint(tint)} ${FIELD_LIGHTNESS} ${FIELD_CHROMA} calc(h + ${jitter}))`
		: "var(--bot-avatar-field-untinted)"
}

const surfaceOf = (ink: string) =>
	`oklch(from ${ink} ${SURFACE_LIGHTNESS} calc(c * ${SURFACE_CHROMA_SHARE}) h)`

const fieldLattice = (seed: number) =>
	Float32Array.from({ length: LATTICE * LATTICE }, seededRandom(seed))

const densityField = (seed: number, grid: FieldGrid): DensityField => {
	const glyph = silhouetteCells(
		pickSilhouette(seed, COMPANION_SILHOUETTE_SPACE),
	).map(({ column, row }) => ({
		x: 0.5 + (column - 2) * COLUMN_STEP,
		y: 0.5 + (row - 3) * ROW_STEP,
	}))
	const silhouette = Float32Array.from(grid.points, ({ u, v }) => {
		let sum = 0
		for (const blob of glyph)
			sum += Math.exp(
				-((u - blob.x) ** 2 + (v - blob.y) ** 2) / (2 * BLOB_SIGMA ** 2),
			)
		return clamp01(sum)
	})
	return { grid, silhouette, lattice: fieldLattice(seed) }
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
	{ grid, silhouette, lattice }: DensityField,
	state: ExplorationState,
	time: number,
) => {
	const drift = state === "idle" ? 0 : time / DRIFT_PERIOD
	return Array.from(silhouette, (shape, index) => {
		const { u, v } = grid.points[index]
		const floor = FLOOR + NOISE_AMPLITUDE * noiseAt(lattice, u + drift, v)
		const hold =
			STATE_HOLD +
			(1 - STATE_HOLD) *
				fieldIntensity(state, { x: u * 2 - 1, y: v * 2 - 1 }, time)
		return clamp01((floor + SILHOUETTE_WEIGHT * shape) * hold)
	})
}

const organicTones = (field: number[], { ahead }: FieldGrid) => {
	const error = Float32Array.from(field)
	return Array.from(error, (_, index) => {
		const value = error[index]
		const tone = TONES.reduce((best, next) =>
			Math.abs(next - value) < Math.abs(best - value) ? next : best,
		)
		for (const { to, share } of ahead[index])
			error[to] += (value - tone) * share
		return tone
	})
}

const fieldTones = (
	field: DensityField,
	state: ExplorationState,
	time: number,
) =>
	organicTones(densities(field, state, time), field.grid).map((tone, index) =>
		field.mask?.[index] === 0 ? 0 : tone,
	)

const traceHexagon = (
	context: CanvasRenderingContext2D,
	centre: FieldPoint,
	radius: number,
	side: number,
) => {
	for (const [corner, { u, v }] of hexagonCorners(centre, radius).entries())
		if (corner === 0) context.moveTo(u * side, v * side)
		else context.lineTo(u * side, v * side)
}

const paintHoneycomb = (
	context: CanvasRenderingContext2D,
	tones: number[],
	{ points, radius }: FieldGrid,
	side: number,
) => {
	for (const [lit, alpha] of TONE_ALPHAS) {
		context.beginPath()
		for (const [index, tone] of tones.entries())
			if (tone === lit)
				traceHexagon(context, points[index], radius * CELL_SHARE, side)
		context.globalAlpha = alpha
		context.fill()
	}
}

const paintSquares = (
	context: CanvasRenderingContext2D,
	tones: number[],
	{ points, radius }: FieldGrid,
	side: number,
) => {
	const half = radius * CELL_SHARE
	for (const [index, tone] of tones.entries()) {
		if (tone === 0) continue
		context.globalAlpha = tone === 1 ? 1 : HALF_TONE_ALPHA
		context.fillRect(
			(points[index].u - half) * side,
			(points[index].v - half) * side,
			2 * half * side,
			2 * half * side,
		)
	}
}

const paintScreen = (
	context: CanvasRenderingContext2D,
	ink: string,
	tones: number[],
	grid: FieldGrid,
	side: number,
) => {
	context.clearRect(0, 0, side, side)
	context.fillStyle = ink
	if (grid.shape === "hexagon") paintHoneycomb(context, tones, grid, side)
	else paintSquares(context, tones, grid, side)
	context.globalAlpha = 1
}

const DitheredField = ({
	name,
	state,
	size,
	field,
	ink,
	surface,
	tint,
}: DitheredFieldProps) => {
	const canvas = useRef<HTMLCanvasElement>(null)
	const prefersReducedMotion = usePrefersReducedMotion()
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
				getComputedStyle(element).color,
				fieldTones(field, drawnState, time),
				field.grid,
				side,
			)
		},
	})

	return (
		<ExplorationFrame
			name={name}
			size={size}
			state={state}
			surface={surface}
			tint={tint}
		>
			<canvas
				className="pointer-events-none size-full"
				data-cells={field.grid.cells}
				data-screen={DITHER_SCREEN}
				ref={canvas}
				style={{ color: ink }}
			/>
		</ExplorationFrame>
	)
}

const DitheredFieldAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
	hasGround = true,
	ink: fieldInk = "companion",
}: DitheredFieldAvatarProps) => {
	const seed = companionSeed(name)
	const ink = fieldInk === "foreground" ? FOREGROUND_INK : inkOf(seed, tint)

	return (
		<DitheredField
			field={densityField(seed, COMPANION_GRID)}
			ink={ink}
			name={name}
			size={size}
			state={state}
			surface={hasGround ? surfaceOf(ink) : undefined}
			tint={tint}
		/>
	)
}

export {
	type DensityField,
	DitheredField,
	DitheredFieldAvatar,
	type DitheredFieldAvatarProps,
	FIELD_CELLS,
	fieldLattice,
	fieldTones,
}
