export type OpenedRoutine = {
	routineId: string
	conversationId: string
}

export type OpenedRoutineController = {
	getState: () => OpenedRoutine | null
	subscribe: (listener: () => void) => () => void
	open: (opened: OpenedRoutine) => void
	leave: () => void
}

export const createOpenedRoutineController = (): OpenedRoutineController => {
	let opened: OpenedRoutine | null = null
	const listeners = new Set<() => void>()

	const set = (next: OpenedRoutine | null) => {
		opened = next
		for (const listener of [...listeners]) {
			listener()
		}
	}

	return {
		getState: () => opened,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: (next) => set(next),

		leave: () => set(null),
	}
}
