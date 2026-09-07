import { useEffect, useRef } from "react"

import { spaceRankOf } from "@workspace/ui/hooks/use-space-shortcut"

const NEXT = 1

const PREVIOUS = -1

export type SearchKeys = {
	isOpen: boolean
	onOpen: () => void
	onMove: (by: number) => void
	onEnter: () => void
	onRank: (rank: number) => void
}

type SearchKeyPress = (keys: SearchKeys) => void

const PRESS_BY_KEY = new Map<string, SearchKeyPress>([
	["ArrowDown", ({ onMove }) => onMove(NEXT)],
	["ArrowUp", ({ onMove }) => onMove(PREVIOUS)],
	["Enter", ({ onEnter }) => onEnter()],
])

const isOpeningChord = (event: KeyboardEvent) =>
	event.metaKey && event.key.toLowerCase() === "k"

const pressOf = (event: KeyboardEvent): SearchKeyPress | undefined => {
	const rank = spaceRankOf(event)
	if (rank !== 0) {
		return ({ onRank }) => onRank(rank)
	}
	return PRESS_BY_KEY.get(event.key)
}

export const useSearchKeys = (keys: SearchKeys) => {
	const reach = useRef(keys)
	reach.current = keys

	useEffect(() => {
		const press = (event: KeyboardEvent) => {
			const held = reach.current

			if (isOpeningChord(event)) {
				event.preventDefault()
				if (!held.isOpen) {
					held.onOpen()
				}
				return
			}

			const pressed = held.isOpen ? pressOf(event) : undefined
			if (!pressed) {
				return
			}

			event.preventDefault()
			pressed(held)
		}

		window.addEventListener("keydown", press, true)
		return () => window.removeEventListener("keydown", press, true)
	}, [])
}
