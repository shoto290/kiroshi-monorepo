"use client"

import { useRef } from "react"

import {
	type AvatarCell,
	companionField,
	type DensityField,
	FIELD_CHROMA,
	fieldCells,
	fieldTones,
	hueShift,
	TONE_OPACITIES,
} from "@workspace/ui/components/companion-avatar"
import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/companion-colour"
import type {
	FieldAvatarProps,
	FieldState,
} from "@workspace/ui/components/companion-field"
import { FieldFrame, useFieldClock } from "@workspace/ui/components/field-frame"
import {
	type FieldGrid,
	hexagonCorners,
} from "@workspace/ui/components/field-grid"
import { useColorScheme } from "@workspace/ui/hooks/use-color-scheme"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

type FieldInk = "companion" | "foreground"

type DitheredFieldAvatarProps = FieldAvatarProps & {
	hasGround?: boolean
	ink?: FieldInk
}

type DitheredFieldProps = {
	name: string
	state: FieldState
	size: number
	field: DensityField
	ink: string
	surface?: string
	tint?: BotAvatarBlot
}

const DITHER_SCREEN = "square-tone"
const FOREGROUND_INK = "var(--foreground)"
const UNTINTED_FIELD = "var(--bot-avatar-field-untinted)"

const inkOf = (name: string, tint?: BotAvatarBlot) =>
	tint
		? `oklch(from ${blotTint(tint)} var(--bot-avatar-field-lightness) ${FIELD_CHROMA} calc(h + ${hueShift(name)}))`
		: UNTINTED_FIELD

const groundOf = (tint?: BotAvatarBlot) =>
	`color-mix(in oklab, ${tint ? blotTint(tint) : UNTINTED_FIELD} var(--bot-avatar-ground-strength), var(--secondary))`

const traceHexagon = (
	context: CanvasRenderingContext2D,
	cell: AvatarCell,
	side: number,
) => {
	for (const [corner, { u, v }] of hexagonCorners(cell, cell.radius).entries())
		if (corner === 0) context.moveTo(u * side, v * side)
		else context.lineTo(u * side, v * side)
}

const paintHoneycomb = (
	context: CanvasRenderingContext2D,
	cells: AvatarCell[],
	tones: number[],
	side: number,
) => {
	for (const { tone: lit, opacity } of TONE_OPACITIES) {
		context.beginPath()
		for (const [index, tone] of tones.entries())
			if (tone === lit) traceHexagon(context, cells[index], side)
		context.globalAlpha = opacity
		context.fill()
	}
}

const paintSquares = (
	context: CanvasRenderingContext2D,
	cells: AvatarCell[],
	tones: number[],
	side: number,
) => {
	for (const [index, tone] of tones.entries()) {
		const opacity = TONE_OPACITIES.find((entry) => entry.tone === tone)?.opacity
		if (opacity === undefined) continue
		const { u, v, radius } = cells[index]
		context.globalAlpha = opacity
		context.fillRect(
			(u - radius) * side,
			(v - radius) * side,
			2 * radius * side,
			2 * radius * side,
		)
	}
}

const paintScreen = (
	context: CanvasRenderingContext2D,
	ink: string,
	shape: FieldGrid["shape"],
	cells: AvatarCell[],
	tones: number[],
	side: number,
) => {
	context.clearRect(0, 0, side, side)
	context.fillStyle = ink
	if (shape === "hexagon") paintHoneycomb(context, cells, tones, side)
	else paintSquares(context, cells, tones, side)
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
	useColorScheme(canvas)

	useFieldClock({
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
				field.grid.shape,
				fieldCells(field.grid),
				fieldTones(field, drawnState, time),
				side,
			)
		},
	})

	return (
		<FieldFrame
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
		</FieldFrame>
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
	const ink = fieldInk === "foreground" ? FOREGROUND_INK : inkOf(name, tint)

	return (
		<DitheredField
			field={companionField(name)}
			ink={ink}
			name={name}
			size={size}
			state={state}
			surface={hasGround ? groundOf(tint) : undefined}
			tint={tint}
		/>
	)
}

export { DitheredField, DitheredFieldAvatar }
