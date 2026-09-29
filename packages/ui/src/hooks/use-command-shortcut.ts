import { useEffect, useRef } from "react"

import { isTypingTarget } from "@workspace/ui/lib/typing-target"

type CommandShortcut = {
	chordKey: string
	isEnabled: boolean
	onPress: () => void
}

const isCommandChord = (event: KeyboardEvent, chordKey: string) =>
	event.metaKey &&
	event.key.toLowerCase() === chordKey &&
	!event.isComposing &&
	!isTypingTarget(event.target)

export const useCommandShortcut = ({
	chordKey,
	isEnabled,
	onPress,
}: CommandShortcut) => {
	const reach = useRef(onPress)
	reach.current = onPress

	useEffect(() => {
		if (!isEnabled) return

		const press = (event: KeyboardEvent) => {
			if (!isCommandChord(event, chordKey)) return
			event.preventDefault()
			reach.current()
		}

		window.addEventListener("keydown", press, true)
		return () => window.removeEventListener("keydown", press, true)
	}, [chordKey, isEnabled])
}
