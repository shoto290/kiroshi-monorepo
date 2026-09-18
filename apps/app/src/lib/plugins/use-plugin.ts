import {
	createPluginController,
	type PluginController,
	type PluginState,
} from "./plugin-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type Plugin = {
	state: PluginState
	controller: PluginController
}

export const usePlugin = (store: TranscriptStore): Plugin =>
	useController(() => createPluginController(store))
