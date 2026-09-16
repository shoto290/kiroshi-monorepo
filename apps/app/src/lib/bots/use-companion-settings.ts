import { useEffect } from "react"

import type { HistoryController } from "./history-controller"
import type { McpServersController } from "./mcp-servers-controller"
import type { SkillsController } from "./skills-controller"

import type { ApplicationsController } from "../applications/applications-controller"
import type { ConnectionsController } from "../applications/connections-controller"
import type { EnvironmentController } from "../environment/environment-controller"

export type CompanionSettings = {
	applications: Pick<ApplicationsController, "open">
	skills: Pick<SkillsController, "open">
	servers: Pick<McpServersController, "open">
	environment: Pick<EnvironmentController, "open">
	connections: Pick<ConnectionsController, "open">
	history: Pick<HistoryController, "open">
	companionId: string | null
	spaceId: string | null
	isOpen: boolean
}

export const useCompanionSettings = ({
	applications,
	skills,
	servers,
	environment,
	connections,
	history,
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
		void skills.open(companionId)
		void servers.open(owner)
		void environment.open(owner)
		void connections.open(owner)
		void history.open(companionId)
	}, [
		applications,
		skills,
		servers,
		environment,
		connections,
		history,
		companionId,
		spaceId,
		isOpen,
	])
}
