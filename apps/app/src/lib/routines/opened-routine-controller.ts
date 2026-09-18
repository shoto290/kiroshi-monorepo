import {
	createOpenedController,
	type OpenedController,
} from "../opened-controller"

export type OpenedRoutine = {
	routineId: string
	conversationId: string
}

export type OpenedRoutineController = OpenedController<OpenedRoutine>

export const createOpenedRoutineController = (): OpenedRoutineController =>
	createOpenedController<OpenedRoutine>()
