import { useEffect, useRef } from "react"

import { spaceRankOf } from "@workspace/ui/hooks/use-space-shortcut"

const NEXT = 1

const PREVIOUS = -1

const CONTROLS_THAT_KEEP_THEIR_KEYS =
	'button, a[href], [role="button"], [role="link"], [role="tab"], [role="switch"]'

export type SearchKeys = {
	isOpen: boolean
	canOpen: boolean
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

const keepsItsOwnKeys = (target: EventTarget | null) =>
	target instanceof Element && target.matches(CONTROLS_THAT_KEEP_THEIR_KEYS)

const pressOf = (event: KeyboardEvent): SearchKeyPress | undefined => {
	const rank = spaceRankOf(event)
	if (rank !== 0) {
		return ({ onRank }) => onRank(rank)
	}
	return keepsItsOwnKeys(event.target) ? undefined : PRESS_BY_KEY.get(event.key)
}

export const useSearchKeys = (keys: SearchKeys) => {
	const reach = useRef(keys)
	reach.current = keys

	useEffect(() => {
		const press = (event: KeyboardEvent) => {
			const held = reach.current

			if (isOpeningChord(event)) {
				event.preventDefault()
				if (!held.isOpen && held.canOpen) {
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
