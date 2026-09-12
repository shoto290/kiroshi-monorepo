"use client"

import { useCallback, useRef, useSyncExternalStore } from "react"

const NO_OP = () => {}

const FIRST_CANDIDATE = 0

const getServerSnapshot = () => FIRST_CANDIDATE

const fittingIn = (candidates: HTMLElement, box: HTMLElement) => {
	const room = box.clientWidth
	const widths = [...candidates.children].map((child) => child.scrollWidth)
	const fitting = widths.findIndex((width) => width <= room)

	return fitting === -1 ? widths.length - 1 : fitting
}

export const useFittingCandidate = (
	candidates: HTMLElement | null,
	box: HTMLElement | null,
) => {
	const fitting = useRef(FIRST_CANDIDATE)

	const subscribe = useCallback(
		(onChange: () => void) => {
			if (!candidates || !box) return NO_OP

			const observer = new ResizeObserver(() => {
				const next = fittingIn(candidates, box)
				if (next === fitting.current) return
				fitting.current = next
				onChange()
			})
			observer.observe(candidates)
			observer.observe(box)

			return () => observer.disconnect()
		},
		[candidates, box],
	)

	const getSnapshot = useCallback(() => fitting.current, [])

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
