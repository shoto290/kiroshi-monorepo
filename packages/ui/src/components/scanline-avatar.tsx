"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	stepCount,
	stillTime,
	toField,
	variantSteps,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useFieldOpacity,
} from "@workspace/ui/components/avatar-exploration-frame"

type Profile = (depth: number) => number

type ScanSegment = {
	row: number
	slot: number
	x1: number
	x2: number
	y: number
}

const VIEW = 100
const MIDDLE = VIEW / 2
const ROWS = 7
const ROW_PITCH = 10
const TOP = MIDDLE - ((ROWS - 1) * ROW_PITCH) / 2
const SLOTS = 7
const SLOT_PITCH = 10
const HALF_SPAN = (SLOTS * SLOT_PITCH) / 2
const STROKE = 5.5
const DASHES = [SLOT_PITCH, 5, 0]

const PROFILES: Profile[] = [
	(depth) => 0.45 + 0.5 * Math.sin(Math.PI * depth),
	(depth) => 0.25 + 0.75 * Math.abs(2 * depth - 1),
	(depth) => 0.15 + 0.85 * Math.sin((Math.PI / 2) * Math.min(depth * 1.25, 1)),
	(depth) => (depth < 0.5 ? 1 : 1 - (depth - 0.5) * 1.6),
	(depth) => 0.2 + 0.8 * depth * depth,
	(depth) => Math.sqrt(Math.max(0, 1 - (2 * depth - 1) ** 4)),
]

const SCANLINE_STEPS = [ROWS + 1, DASHES.length, 2, 2] as const

const SCANLINE_SPACE = {
	families: PROFILES.length,
	variants: stepCount(SCANLINE_STEPS),
}

const scanSegments = ({ family, variant }: Silhouette): ScanSegment[] => {
	const profile = PROFILES[family]
	const [cutRow, dashStep, splitStep, brickStep] = variantSteps(
		variant,
		SCANLINE_STEPS,
	)
	const dash = DASHES[dashStep]
	const isSplit = splitStep === 1
	const isBrick = brickStep === 1

	const segments: ScanSegment[] = []
	for (let row = 0; row < ROWS; row++) {
		if (row === cutRow) continue
		const depth = row / (ROWS - 1)
		const halfWidth = HALF_SPAN * profile(depth)
		const y = TOP + row * ROW_PITCH
		for (let slot = 0; slot < SLOTS; slot++) {
			const shift = isBrick && row % 2 === 1 ? SLOT_PITCH / 2 : 0
			const center = MIDDLE - HALF_SPAN + (slot + 0.5) * SLOT_PITCH + shift
			const offset = Math.abs(center - MIDDLE)
			if (offset > halfWidth || (isSplit && offset < SLOT_PITCH / 2)) continue
			const x1 = center - dash / 2
			const x2 = center + dash / 2
			segments.push({ row, slot, x1, x2, y })
		}
	}
	return segments
}

const scanlineKey = (silhouette: Silhouette) =>
	scanSegments(silhouette)
		.map(({ row, x1, x2 }) => `${row}:${x1}-${x2}`)
		.join(" ")

const ScanlineAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
}: ExplorationAvatarProps) => {
	const root = useRef<SVGSVGElement>(null)
	const silhouette = pickSilhouette(companionSeed(name, tint), SCANLINE_SPACE)
	useFieldOpacity({ state, root })

	return (
		<ExplorationFrame name={name} size={size} state={state} tint={tint}>
			<svg
				aria-hidden="true"
				className="pointer-events-none size-full"
				ref={root}
				viewBox={`0 0 ${VIEW} ${VIEW}`}
			>
				{scanSegments(silhouette).map((segment) => {
					const point = {
						x: toField((segment.x1 + segment.x2) / 2, VIEW),
						y: toField(segment.y, VIEW),
					}
					return (
						<line
							data-x={point.x}
							data-y={point.y}
							key={`${segment.row},${segment.slot}`}
							opacity={fieldIntensity(state, point, stillTime(state))}
							stroke="currentColor"
							strokeLinecap="round"
							strokeWidth={STROKE}
							x1={segment.x1}
							x2={segment.x2}
							y1={segment.y}
							y2={segment.y}
						/>
					)
				})}
			</svg>
		</ExplorationFrame>
	)
}

export { SCANLINE_SPACE, ScanlineAvatar, scanlineKey, scanSegments }
