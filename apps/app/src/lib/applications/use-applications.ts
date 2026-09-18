import type { ApplicationPort } from "./application-port"
import {
	type ApplicationsController,
	type ApplicationsState,
	createApplicationsController,
} from "./applications-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type Applications = {
	state: ApplicationsState
	controller: ApplicationsController
}

export const useApplications = (
	port: ApplicationPort,
	store: TranscriptStore,
): Applications =>
	useController(() => createApplicationsController(port, store))
