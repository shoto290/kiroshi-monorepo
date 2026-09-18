export type Store<State> = {
	getState: () => State
	setState: (next: State) => void
	subscribe: (listener: () => void) => () => void
}

export const createStore = <State>(initial: State): Store<State> => {
	let state = initial
	const listeners = new Set<() => void>()

	const publish = () => {
		for (const listener of [...listeners]) {
			listener()
		}
	}

	return {
		getState: () => state,

		setState: (next) => {
			state = next
			publish()
		},

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}
}
