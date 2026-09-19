import type { CompanionSpoke } from "./transcript-contract"

export type SpokenWord = Pick<CompanionSpoke, "conversationId" | "authorBotId">

type SpokenWordListener = (word: SpokenWord) => void

export type SpokenWords = {
	announce: (word: SpokenWord) => void
	subscribe: (listener: SpokenWordListener) => () => void
}

export const createSpokenWords = (): SpokenWords => {
	const listeners = new Set<SpokenWordListener>()

	return {
		announce: (word) => {
			for (const listener of [...listeners]) {
				listener(word)
			}
		},

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}
}
