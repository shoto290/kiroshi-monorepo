import { useState, useSyncExternalStore } from "react"

import type { ConnectionPort } from "./connection-port"
import {
	type ConnectionsController,
	type ConnectionsState,
	createConnectionsController,
} from "./connections-controller"

export type Connections = {
	state: ConnectionsState
	controller: ConnectionsController
}

export const useConnections = (port: ConnectionPort): Connections => {
	const [controller] = useState(() => createConnectionsController(port))
	const state = useSyncExternalStore(controller.subscribe, controller.getState)

	return { state, controller }
}
