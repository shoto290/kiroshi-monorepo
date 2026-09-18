import {
	createUserPluginController,
	type UserPluginController,
	type UserPluginState,
} from "./user-plugin-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type UserPlugin = {
	state: UserPluginState
	controller: UserPluginController
}

export const useUserPlugin = (store: TranscriptStore): UserPlugin =>
	useController(() => createUserPluginController(store))
