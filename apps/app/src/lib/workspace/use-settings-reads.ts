import { useEffect } from "react"

import { onHostReconnected } from "../host"
import type { ApplicationsController } from "../applications/applications-controller"
import type { ConnectionsController } from "../applications/connections-controller"
import type { McpServersController } from "../bots/mcp-servers-controller"
import type { EnvironmentController } from "../environment/environment-controller"

type EnvironmentReader = Pick<EnvironmentController, "open" | "reload">

export type SpaceSettingsReads = {
	applications: Pick<ApplicationsController, "open">
	environment: EnvironmentReader
	servers: Pick<McpServersController, "open" | "reload">
	connections: Pick<ConnectionsController, "open" | "reload">
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
		void applications.open()
		void environment.open(owner)
		void servers.open(owner)
		void connections.open(owner)
		return onHostReconnected(() => {
			void applications.open()
			void environment.reload()
			void servers.reload()
			void connections.reload()
		})
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
		void environment.open(server)
		return onHostReconnected(() => {
			void environment.reload()
		})
	}, [environment, server])
}
