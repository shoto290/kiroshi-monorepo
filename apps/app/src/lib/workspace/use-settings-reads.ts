import { useEffect } from "react"

import { onHostReconnected } from "../host"
import type { ApplicationsController } from "../applications/applications-controller"
import type { ConnectionsController } from "../applications/connections-controller"
import type { McpServersController } from "../bots/mcp-servers-controller"
import type { EnvironmentController } from "../environment/environment-controller"

type EnvironmentReader = Pick<EnvironmentController, "open">

export type SpaceSettingsReads = {
	applications: Pick<ApplicationsController, "open">
	environment: EnvironmentReader
	servers: Pick<McpServersController, "open">
	connections: Pick<ConnectionsController, "open">
	spaceId: string | null
	isOpen: boolean
}

export const useSpaceSettingsReads = ({
	applications,
	environment,
	servers,
	connections,
	spaceId,
	isOpen,
}: SpaceSettingsReads) => {
	useEffect(() => {
		if (!isOpen || !spaceId) {
			return
		}
		const owner = { kind: "space", id: spaceId } as const
		const readPanels = () => {
			void applications.open()
			void environment.open(owner)
			void servers.open(owner)
			void connections.open(owner)
		}
		readPanels()
		return onHostReconnected(readPanels)
	}, [applications, environment, servers, connections, spaceId, isOpen])
}

type ServerEnvironmentReads = {
	environment: EnvironmentReader
	server: Parameters<EnvironmentController["open"]>[0] | null
}

export const useServerEnvironmentReads = ({
	environment,
	server,
}: ServerEnvironmentReads) => {
	useEffect(() => {
		if (!server) {
			return
		}
		const readPanel = () => {
			void environment.open(server)
		}
		readPanel()
		return onHostReconnected(readPanel)
	}, [environment, server])
}
