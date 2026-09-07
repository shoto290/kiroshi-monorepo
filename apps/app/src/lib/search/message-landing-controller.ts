export type MessageLanding = {
	conversationId: string
	messageId: string
	seq: number
}

export type MessageLandingController = {
	getState: () => MessageLanding | null
	subscribe: (listener: () => void) => () => void
	record: (landing: MessageLanding) => void
	forget: (landing: MessageLanding) => void
}

export const createMessageLandingController = (): MessageLandingController => {
	let landing: MessageLanding | null = null
	const listeners = new Set<() => void>()

	const set = (next: MessageLanding | null) => {
		landing = next
		for (const listener of [...listeners]) {
			listener()
		}
	}

	return {
		getState: () => landing,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		record: (next) => set(next),

		forget: (taken) => {
			if (landing === taken) {
				set(null)
			}
		},
	}
}
