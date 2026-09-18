import { useEffect } from "react"

import type { McpServersController } from "./mcp-servers-controller"

import type { ApplicationsController } from "../applications/applications-controller"
import type { ConnectionsController } from "../applications/connections-controller"
import { botPlugin } from "../conversations/plugin-scope"
import type { EnvironmentController } from "../environment/environment-controller"
import type { PluginController } from "../plugins/plugin-controller"

export type CompanionSettings = {
	applications: Pick<ApplicationsController, "open">
	plugin: Pick<PluginController, "open">
	servers: Pick<McpServersController, "open">
	environment: Pick<EnvironmentController, "open">
	connections: Pick<ConnectionsController, "open">
	companionId: string | null
	spaceId: string | null
	isOpen: boolean
}

export const useCompanionSettings = ({
	applications,
	plugin,
	servers,
	environment,
	connections,
	companionId,
	spaceId,
	isOpen,
}: CompanionSettings) => {
	useEffect(() => {
		if (!isOpen || !companionId || !spaceId) {
			return
		}
		const owner = { kind: "bot", id: companionId, spaceId } as const
		void applications.open()
		void plugin.open(botPlugin(companionId))
		void servers.open(owner)
		void environment.open(owner)
		void connections.open(owner)
	}, [
		applications,
		plugin,
		servers,
		environment,
		connections,
		companionId,
		spaceId,
		isOpen,
	])
}
