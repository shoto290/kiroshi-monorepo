import { type PointerEvent as ReactPointerEvent, useRef } from "react"

import {
	hasTravelledPastLiftThreshold,
	type Point,
} from "@workspace/ui/hooks/use-roster-lift"

export interface WindowDragPressHandlers {
	onKeyDown: () => void
	onPointerCancel: () => void
	onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
	onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
	onPointerUp: () => void
}

export interface WindowDragPress {
	handlers: WindowDragPressHandlers
	hasJustDragged: () => boolean
}

export const useWindowDragPress = (
	onDragWindow: (() => void) | undefined,
): WindowDragPress => {
	const pressedAt = useRef<Point | null>(null)
	const hasDragged = useRef(false)

	const release = () => {
		pressedAt.current = null
	}

	const handlers: WindowDragPressHandlers = {
		onKeyDown: () => {
			hasDragged.current = false
		},
		onPointerCancel: release,
		onPointerDown: (event) => {
			hasDragged.current = false
			if (!onDragWindow || event.button !== 0) return
			pressedAt.current = { x: event.clientX, y: event.clientY }
		},
		onPointerMove: (event) => {
			const from = pressedAt.current
			if (!from) return
			const to = { x: event.clientX, y: event.clientY }
			if (!hasTravelledPastLiftThreshold(from, to)) return
			release()
			hasDragged.current = true
			onDragWindow?.()
		},
		onPointerUp: release,
	}

	const hasJustDragged = () => {
		const wasDragged = hasDragged.current
		hasDragged.current = false
		return wasDragged
	}

	return { handlers, hasJustDragged }
}
