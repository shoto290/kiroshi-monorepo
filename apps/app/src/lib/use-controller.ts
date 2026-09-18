import { useState, useSyncExternalStore } from "react"

type Observable<State> = {
	getState: () => State
	subscribe: (listener: () => void) => () => void
}

export type Controlled<State, Controller> = {
	state: State
	controller: Controller
}

export const useControllerState = <State>(controller: Observable<State>) =>
	useSyncExternalStore(controller.subscribe, controller.getState)

export const useController = <State, Controller extends Observable<State>>(
	create: () => Controller & Observable<State>,
): Controlled<State, Controller> => {
	const [controller] = useState(create)
	const state = useControllerState(controller)

	return { state, controller }
}
