"use client"

import { type PointerEvent as ReactPointerEvent, useRef } from "react"

import { clamp } from "@workspace/ui/components/bot-avatar-3d"
import type { BotAvatarOrientation } from "@workspace/ui/components/bot-avatar-engine"

const DEGREES_PER_PIXEL = 0.6
const LIMIT = 60

type AvatarPointerEvent = ReactPointerEvent<SVGSVGElement>

type BotAvatarDrag = {
	interactive: boolean
	yaw?: number
	pitch?: number
	roll?: number
	onOrientationChange?: (orientation: BotAvatarOrientation) => void
}

const useBotAvatarDrag = ({
	interactive,
	yaw,
	pitch,
	roll,
	onOrientationChange,
}: BotAvatarDrag) => {
	const dragRef = useRef({ x: 0, y: 0, yaw: 0, pitch: 0, roll: 0 })

	const startDrag = (event: AvatarPointerEvent) => {
		if (!interactive) return
		event.currentTarget.setPointerCapture(event.pointerId)
		dragRef.current = {
			x: event.clientX,
			y: event.clientY,
			yaw: yaw ?? 0,
			pitch: pitch ?? 0,
			roll: roll ?? 0,
		}
	}

	const moveDrag = (event: AvatarPointerEvent) => {
		if (!interactive || !event.currentTarget.hasPointerCapture(event.pointerId))
			return
		const origin = dragRef.current
		onOrientationChange?.({
			yaw: clamp(
				origin.yaw + (event.clientX - origin.x) * DEGREES_PER_PIXEL,
				-LIMIT,
				LIMIT,
			),
			pitch: clamp(
				origin.pitch - (event.clientY - origin.y) * DEGREES_PER_PIXEL,
				-LIMIT,
				LIMIT,
			),
			roll: origin.roll,
		})
	}

	const endDrag = (event: AvatarPointerEvent) => {
		if (!interactive) return
		event.currentTarget.releasePointerCapture(event.pointerId)
	}

	return { startDrag, moveDrag, endDrag }
}

export { useBotAvatarDrag }
