import { useState, useSyncExternalStore } from "react"

import type { ConnectorPort } from "./connector-port"
import {
	type ConnectorsController,
	type ConnectorsState,
	createConnectorsController,
} from "./connectors-controller"

export type Connectors = {
	state: ConnectorsState
	controller: ConnectorsController
}

export const useConnectors = (port: ConnectorPort): Connectors => {
	const [controller] = useState(() => createConnectorsController(port))
	const state = useSyncExternalStore(controller.subscribe, controller.getState)

	return { state, controller }
}
