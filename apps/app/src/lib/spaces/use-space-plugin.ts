import {
	createSpacePluginController,
	type SpacePluginController,
	type SpacePluginState,
} from "./space-plugin-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type SpacePlugin = {
	state: SpacePluginState
	controller: SpacePluginController
}

export const useSpacePlugin = (store: TranscriptStore): SpacePlugin =>
	useController(() => createSpacePluginController(store))
