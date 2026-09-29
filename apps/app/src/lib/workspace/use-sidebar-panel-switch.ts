import { useCallback } from "react"

import type { RosterController, RosterState } from "../bots/roster-controller"
import type { OpenedMissionController } from "../missions/opened-mission-controller"
import type { ShownMemory } from "../sidebar/shown-memory"
import { type SidebarPanel, useSidebarTab } from "../user/use-sidebar-tab"
import type { User } from "../user/use-user"

type SidebarPanelSwitchCore = {
	openedMission: Pick<OpenedMissionController, "leave">
	roster: {
		controller: Pick<RosterController, "select" | "selectConversation"> & {
			getState: () => Pick<RosterState, "spaceId" | "bots" | "conversations">
		}
	}
	shownMemory: Pick<ShownMemory, "lastRowIn">
	user: User
}

type SidebarPanelSwitchInput = {
	core: SidebarPanelSwitchCore
	sidebarMissions: { showLastMission: () => void }
}

const showLastConversation = (
	roster: SidebarPanelSwitchCore["roster"]["controller"],
	shownMemory: SidebarPanelSwitchCore["shownMemory"],
) => {
	const { spaceId, bots, conversations } = roster.getState()
	const lastRowId = spaceId === null ? null : shownMemory.lastRowIn(spaceId)
	const bot = bots.find(({ id }) => id === lastRowId)
	const conversation = conversations.find(({ id }) => id === lastRowId)

	if (bot) {
		roster.select(bot.id)
	} else if (conversation) {
		roster.selectConversation(conversation.id)
	} else if (bots[0]) {
		roster.select(bots[0].id)
	} else if (conversations[0]) {
		roster.selectConversation(conversations[0].id)
	}
}

export const useSidebarPanelSwitch = ({
	core,
	sidebarMissions,
}: SidebarPanelSwitchInput) => {
	const { openedMission, roster, shownMemory, user } = core
	const { openTab, openSidebarTab } = useSidebarTab(user)
	const { showLastMission } = sidebarMissions

	const switchPanel = useCallback(
		(panel: SidebarPanel) => {
			openSidebarTab(panel)
			if (panel === "missions") {
				showLastMission()
				return
			}
			openedMission.leave()
			showLastConversation(roster.controller, shownMemory)
		},
		[
			openSidebarTab,
			showLastMission,
			openedMission,
			roster.controller,
			shownMemory,
		],
	)

	return { openTab, openSidebarTab: switchPanel }
}
