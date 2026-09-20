import { useMemo } from "react"

import type { WorkspaceCore } from "./use-workspace-core"
import type { WorkspaceDrivers } from "./use-workspace-drivers"

import { missionsBySpaceId } from "../missions/missions-model"

type RosterViewInput = {
	core: WorkspaceCore
	drivers: WorkspaceDrivers
}

export const useRosterView = ({ core, drivers }: RosterViewInput) => {
	const { roster } = core
	const { missionBoard, waitingMissionIds } = drivers

	const {
		bots,
		conversations,
		conversationRosters,
		soloThreads,
		spaceId: rosteredSpaceId,
		selectedBotId,
		selectedConversationId,
		settingsBotId,
		settingsConversationId,
		isEditing,
		isShowingDanger,
		isEditingConversation,
		hasLoaded,
	} = roster.state
	const selected = bots.find((bot) => bot.id === selectedBotId)
	const selectedConversation = conversations.find(
		(conversation) => conversation.id === selectedConversationId,
	)
	const settingsBot = bots.find((bot) => bot.id === settingsBotId)
	const settingsConversation = conversations.find(
		(conversation) => conversation.id === settingsConversationId,
	)
	const missions = useMemo(
		() =>
			missionsBySpaceId({
				board: missionBoard,
				conversationRosters,
				soloThreads,
				waitingMissionIds,
			}),
		[missionBoard, conversationRosters, soloThreads, waitingMissionIds],
	)

	return {
		bots,
		conversationRosters,
		conversations,
		hasLoaded,
		isEditing,
		isEditingConversation,
		isShowingDanger,
		missions,
		rosteredSpaceId,
		selected,
		selectedBotId,
		selectedConversation,
		selectedConversationId,
		settingsBot,
		settingsBotId,
		settingsConversation,
		settingsConversationId,
		soloThreads,
	}
}

export type RosterView = ReturnType<typeof useRosterView>
