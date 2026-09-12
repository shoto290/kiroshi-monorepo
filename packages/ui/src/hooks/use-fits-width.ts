"use client"

import { useCallback, useRef, useSyncExternalStore } from "react"

const NO_OP = () => {}

const getServerSnapshot = () => true

export const useFitsWidth = (
	content: HTMLElement | null,
	box: HTMLElement | null,
) => {
	const fits = useRef(true)

	const subscribe = useCallback(
		(onChange: () => void) => {
			if (!content || !box) return NO_OP

			const observer = new ResizeObserver(() => {
				const next = content.scrollWidth <= box.clientWidth
				if (next === fits.current) return
				fits.current = next
				onChange()
			})
			observer.observe(content)
			observer.observe(box)

			return () => observer.disconnect()
		},
		[content, box],
	)

	const getSnapshot = useCallback(() => fits.current, [])

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
