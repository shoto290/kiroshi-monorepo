"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	silhouetteRandom,
	stillTime,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useFieldOpacity,
} from "@workspace/ui/components/avatar-exploration-frame"

type Outline = (x: number, y: number) => boolean

type LatticeDot = { column: number; row: number; x: number; y: number }

const GRID = 7
const CENTER = (GRID - 1) / 2
const VIEW = 100
const INSET = 20
const PITCH = (VIEW - INSET * 2) / (GRID - 1)
const DOT_RADIUS = 4.2
const CARVE_CHANCE = 0.3

const OUTLINES: Outline[] = [
	(x, y) => Math.hypot(x, y) <= 1.1,
	(x, y) => Math.abs(x) + Math.abs(y) <= 1.05,
	() => true,
	(x, y) => Math.abs(y) <= 0.9 && Math.abs(x) * 0.87 + Math.abs(y) * 0.5 <= 1,
	(x, y) => Math.min(Math.abs(x), Math.abs(y)) <= 0.34,
	(x, y) => Math.abs(x) <= (y + 1) / 2 + 0.01,
]

const DOT_LATTICE_SPACE = { families: OUTLINES.length, variants: 256 }

const latticeDots = (silhouette: Silhouette): LatticeDot[] => {
	const outline = OUTLINES[silhouette.family]
	const random = silhouetteRandom(silhouette)
	const carved = new Set<string>()
	for (let row = 0; row < GRID; row++)
		for (let column = 0; column <= CENTER; column++)
			if (random() < CARVE_CHANCE) {
				carved.add(`${column},${row}`)
				carved.add(`${GRID - 1 - column},${row}`)
			}

	const dots: LatticeDot[] = []
	for (let row = 0; row < GRID; row++)
		for (let column = 0; column < GRID; column++) {
			const x = (column - CENTER) / CENTER
			const y = (row - CENTER) / CENTER
			if (outline(x, y) && !carved.has(`${column},${row}`))
				dots.push({ column, row, x, y })
		}
	return dots
}

const latticeKey = (silhouette: Silhouette) =>
	latticeDots(silhouette)
		.map(({ column, row }) => `${column},${row}`)
		.join(" ")

const DotLatticeAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
}: ExplorationAvatarProps) => {
	const root = useRef<SVGSVGElement>(null)
	const silhouette = pickSilhouette(
		companionSeed(name, tint),
		DOT_LATTICE_SPACE,
	)
	useFieldOpacity({ state, root })

	return (
		<ExplorationFrame name={name} size={size} state={state} tint={tint}>
			<svg
				aria-hidden="true"
				className="pointer-events-none size-full"
				ref={root}
				viewBox={`0 0 ${VIEW} ${VIEW}`}
			>
				{latticeDots(silhouette).map((dot) => (
					<circle
						cx={INSET + dot.column * PITCH}
						cy={INSET + dot.row * PITCH}
						data-x={dot.x}
						data-y={dot.y}
						fill="currentColor"
						key={`${dot.column},${dot.row}`}
						opacity={fieldIntensity(state, dot, stillTime(state))}
						r={DOT_RADIUS}
					/>
				))}
			</svg>
		</ExplorationFrame>
	)
}

export { DOT_LATTICE_SPACE, DotLatticeAvatar, latticeDots, latticeKey }
