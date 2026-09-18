import type { ConnectionPort } from "./connection-port"
import {
	type ConnectionsController,
	type ConnectionsState,
	createConnectionsController,
} from "./connections-controller"

import { useController } from "../use-controller"

export type Connections = {
	state: ConnectionsState
	controller: ConnectionsController
}

export const useConnections = (port: ConnectionPort): Connections =>
	useController(() => createConnectionsController(port))
