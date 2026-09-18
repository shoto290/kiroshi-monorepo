import { createStore } from "./store"

export type OpenedController<Thing> = {
	getState: () => Thing | null
	subscribe: (listener: () => void) => () => void
	open: (thing: Thing) => void
	leave: () => void
}

export const createOpenedController = <Thing>(): OpenedController<Thing> => {
	const store = createStore<Thing | null>(null)

	return {
		getState: store.getState,
		subscribe: store.subscribe,
		open: store.setState,
		leave: () => store.setState(null),
	}
}
