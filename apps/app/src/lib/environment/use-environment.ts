import {
	createEnvironmentController,
	type EnvironmentController,
	type EnvironmentState,
} from "./environment-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type Environment = {
	state: EnvironmentState
	controller: EnvironmentController
}

export const useEnvironment = (store: TranscriptStore): Environment =>
	useController(() => createEnvironmentController(store))
