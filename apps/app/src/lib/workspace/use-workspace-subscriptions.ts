import { useEffect } from "react"

import type { ApplicationScopes } from "./use-application-scopes"
import type { RosterView } from "./use-roster-view"
import type { WorkspaceCore } from "./use-workspace-core"
import type { WorkspaceDrivers } from "./use-workspace-drivers"
import { USER_OWNER } from "./user-owner"

import { useCompanionSettings } from "../bots/use-companion-settings"
import { useCompanionAnnouncements } from "../companions/use-companion-announcements"
import { useCompanionArrivals } from "../conversations/use-companion-arrivals"

type WorkspaceSubscriptionsInput = {
	core: WorkspaceCore
	drivers: WorkspaceDrivers
	rosterView: RosterView
	scopes: ApplicationScopes
}

export const useWorkspaceSubscriptions = ({
	core,
	drivers,
	rosterView,
	scopes,
}: WorkspaceSubscriptionsInput) => {
	const {
		applications,
		botConnections,
		botEnvironment,
		botMcpServers,
		chat,
		companionPlugin,
		roster,
		serverEnvironment,
		spaceConnections,
		spaceEnvironment,
		spaceMcpServers,
		user,
		userConnections,
		userMcpServers,
	} = core
	const { onboarding } = drivers
	const {
		bots,
		isEditing,
		rosteredSpaceId,
		selectedBotId,
		selectedConversationId,
		settingsBotId,
	} = rosterView
	const { isSpaceEditing, openedMcpServer, selectedSpaceId } = scopes

	useEffect(() => {
		void user.controller.load()
		return user.controller.followOtherWindows()
	}, [user.controller])

	useCompanionAnnouncements({
		onCreated: (created) => {
			void roster.controller.reload()
			if (!user.controller.getState().preferences.firstRunDone) {
				void onboarding.controller.greetCompanion(created)
			}
		},
		onFirstRunDone: () => void user.controller.load(),
	})

	useCompanionArrivals(() => {
		void roster.controller.reload()
	})

	useCompanionSettings({
		applications: applications.controller,
		plugin: companionPlugin.controller,
		servers: botMcpServers.controller,
		environment: botEnvironment.controller,
		connections: botConnections.controller,
		companionId: settingsBotId,
		spaceId: selectedSpaceId,
		isOpen: isEditing,
	})

	useEffect(() => {
		if (isSpaceEditing && selectedSpaceId) {
			const owner = { kind: "space", id: selectedSpaceId } as const
			void applications.controller.open()
			void spaceEnvironment.controller.open(owner)
			void spaceMcpServers.controller.open(owner)
			void spaceConnections.controller.open(owner)
		}
	}, [
		applications.controller,
		spaceEnvironment.controller,
		spaceMcpServers.controller,
		spaceConnections.controller,
		isSpaceEditing,
		selectedSpaceId,
	])

	useEffect(() => {
		if (openedMcpServer) {
			void serverEnvironment.controller.open(openedMcpServer)
		}
	}, [serverEnvironment.controller, openedMcpServer])

	useEffect(() => {
		if (!user.state.isSettingsOpen) {
			return
		}
		void applications.controller.open()
		void userMcpServers.controller.open(USER_OWNER)
		void userConnections.controller.open(USER_OWNER)
	}, [
		applications.controller,
		userMcpServers.controller,
		userConnections.controller,
		user.state.isSettingsOpen,
	])

	const holdsSelectedBot = bots.some((bot) => bot.id === selectedBotId)

	useEffect(() => {
		if (!selectedBotId || !holdsSelectedBot) {
			return
		}
		void chat.controller.open(selectedBotId, rosteredSpaceId)
		void user.controller.setLastBot({
			spaceId: rosteredSpaceId,
			botId: selectedBotId,
		})
	}, [
		chat.controller,
		user.controller,
		selectedBotId,
		holdsSelectedBot,
		rosteredSpaceId,
	])

	useEffect(() => {
		if (!selectedConversationId) {
			return
		}
		void user.controller.setLastBot({
			spaceId: roster.controller.getState().spaceId,
			botId: selectedConversationId,
		})
	}, [roster.controller, user.controller, selectedConversationId])
}
