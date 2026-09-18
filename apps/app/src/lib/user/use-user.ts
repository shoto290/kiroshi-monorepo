import {
	createUserController,
	type UserController,
	type UserState,
} from "./preferences-controller"

import { useController } from "../use-controller"

export type User = {
	state: UserState
	controller: UserController
}

export const useUser = (): User => useController(createUserController)
