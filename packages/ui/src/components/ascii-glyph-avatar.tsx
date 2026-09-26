"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	seededRandom,
	silhouetteRandom,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useExplorationClock,
} from "@workspace/ui/components/avatar-exploration-frame"

type Symmetry = (column: number, row: number) => [number, number]

type GlyphCell = { column: number; row: number; x: number; y: number }

const COLUMNS = 5
const ROWS = 7
const FILL_CHANCE = 0.55
const MIN_CELLS = 12
const SPINE = (COLUMNS - 1) / 2
const GLYPH_HEIGHT = 0.66
const MIN_CHARACTER_CELL = 3.5
const RAMP_SALT = 0x9e3779b9
const FONT_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace"

const RAMPS = ["@%#*+=-:.", "#&$?!;:,.", "MNHQ0oc:.", "█▓▒░·"]

const SYMMETRIES: Symmetry[] = [
	(column, row) => [Math.min(column, COLUMNS - 1 - column), row],
	(column, row) =>
		column === SPINE ? [-1, 0] : [Math.min(column, COLUMNS - 1 - column), row],
	(column, row) => [
		Math.min(column, COLUMNS - 1 - column),
		Math.min(row, ROWS - 1 - row),
	],
	(column, row) =>
		row * COLUMNS + column <= (ROWS * COLUMNS - 1) / 2
			? [column, row]
			: [COLUMNS - 1 - column, ROWS - 1 - row],
]

const ASCII_GLYPH_SPACE = { families: SYMMETRIES.length, variants: 1024 }

const glyphCells = (silhouette: Silhouette): GlyphCell[] => {
	const symmetry = SYMMETRIES[silhouette.family]
	const random = silhouetteRandom(silhouette)
	const lit = new Map<string, boolean>()
	const isLit = (column: number, row: number) => {
		const key = symmetry(column, row).join(",")
		if (!lit.has(key)) lit.set(key, key === "-1,0" || random() < FILL_CHANCE)
		return lit.get(key) === true
	}

	const isSparse =
		Array.from({ length: ROWS * COLUMNS }).filter((_, index) =>
			isLit(index % COLUMNS, Math.floor(index / COLUMNS)),
		).length < MIN_CELLS

	const cells: GlyphCell[] = []
	for (let row = 0; row < ROWS; row++)
		for (let column = 0; column < COLUMNS; column++)
			if (isLit(column, row) || (isSparse && column === SPINE))
				cells.push({
					column,
					row,
					x: (column / (COLUMNS - 1)) * 2 - 1,
					y: (row / (ROWS - 1)) * 2 - 1,
				})
	return cells
}

const glyphKey = (silhouette: Silhouette) =>
	glyphCells(silhouette)
		.map(({ column, row }) => `${column},${row}`)
		.join(" ")

const rampOf = (seed: number) =>
	RAMPS[Math.floor(seededRandom(seed ^ RAMP_SALT)() * RAMPS.length)]

const AsciiGlyphAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
}: ExplorationAvatarProps) => {
	const canvas = useRef<HTMLCanvasElement>(null)
	const seed = companionSeed(name, tint)
	const cells = glyphCells(pickSilhouette(seed, ASCII_GLYPH_SPACE))
	const ramp = rampOf(seed)

	useExplorationClock({
		state,
		paint: (time) => {
			const element = canvas.current
			const context = element?.getContext("2d")
			if (!element || !context) return
			const scale = window.devicePixelRatio || 1
			const side = Math.round(size * scale)
			if (element.width !== side) {
				element.width = side
				element.height = side
			}
			const cell = (side * GLYPH_HEIGHT) / ROWS
			const left = (side - cell * COLUMNS) / 2
			const top = (side - cell * ROWS) / 2
			const drawsCharacters = cell / scale >= MIN_CHARACTER_CELL

			context.clearRect(0, 0, side, side)
			context.fillStyle = getComputedStyle(element).color
			context.font = `700 ${cell * 1.05}px ${FONT_STACK}`
			context.textAlign = "center"
			context.textBaseline = "middle"
			for (const glyph of cells) {
				const intensity = fieldIntensity(state, glyph, time)
				const x = left + glyph.column * cell
				const y = top + glyph.row * cell
				if (drawsCharacters) {
					const step = Math.round((1 - intensity) * (ramp.length - 1))
					context.globalAlpha = 1
					context.fillText(ramp[step], x + cell / 2, y + cell / 2)
				} else {
					context.globalAlpha = intensity
					context.fillRect(x, y, cell, cell)
				}
			}
		},
	})

	return (
		<ExplorationFrame name={name} size={size} state={state} tint={tint}>
			<canvas className="pointer-events-none size-full" ref={canvas} />
		</ExplorationFrame>
	)
}

export { ASCII_GLYPH_SPACE, AsciiGlyphAvatar, glyphCells, glyphKey }
