import { useCallback, useMemo } from "react"

import type { ApplicationScopes } from "./use-application-scopes"
import type { RosterLines } from "./use-roster-lines"
import type { RosterView } from "./use-roster-view"
import type { WorkspaceCore } from "./use-workspace-core"
import { useWorkspaceShortcuts } from "./use-workspace-shortcuts"

import {
	useSearch,
	useSearchLookups,
	useSearchNavigation,
} from "../search/use-search"
import { useTheme } from "../theme/use-theme"
import { toUserSettingsValue } from "../user/user-settings"

type WorkspaceOverlayInput = {
	core: WorkspaceCore
	rosterLines: RosterLines
	rosterView: RosterView
	scopes: ApplicationScopes
}

export const useWorkspaceOverlay = ({
	core,
	rosterLines,
	rosterView,
	scopes,
}: WorkspaceOverlayInput) => {
	const {
		messageLandings,
		openedMission,
		openedRoutine,
		preferences,
		roster,
		spaces,
		user,
	} = core
	const { now, sidebarActions, startConversation } = rosterLines
	const {
		conversationRosters,
		isEditing,
		isEditingConversation,
		selectedBotId,
		selectedConversationId,
		settingsBotId,
		settingsConversationId,
	} = rosterView
	const { isSpaceEditing, selectedSpace, selectedSpaceId } = scopes

	const isDialogOpen = [
		isEditing,
		isEditingConversation,
		user.state.isSettingsOpen,
		isSpaceEditing,
	].some(Boolean)

	const searchLookups = useSearchLookups({
		rosters: roster.state.rosters,
		conversationRosters,
		spaces: spaces.state.spaces,
		readerName: preferences.displayName,
		now,
	})

	const searchNavigation = useSearchNavigation({
		roster: roster.controller,
		spaces: spaces.controller,
		missions: openedMission,
		routines: openedRoutine,
		landings: messageLandings,
		user: user.controller,
	})

	const search = useSearch({
		spaceId: selectedSpaceId,
		spaceName: selectedSpace?.name,
		lookups: searchLookups,
		navigation: searchNavigation,
		canOpen: !isDialogOpen,
	})

	const isOverlayOpen = search.isOpen || isDialogOpen

	const isThreadSettingsOpen = isEditing && settingsBotId === selectedBotId

	const isThreadConversationSettingsOpen =
		isEditingConversation && settingsConversationId === selectedConversationId

	const toggleSettings = useCallback(() => {
		if (isThreadSettingsOpen) {
			roster.controller.setEditing(false)
			return
		}
		if (selectedBotId) {
			roster.controller.edit(selectedBotId)
		}
	}, [roster.controller, isThreadSettingsOpen, selectedBotId])

	const userSettings = useMemo(
		() => toUserSettingsValue(preferences),
		[preferences],
	)

	const activityPanel = useMemo(
		() => ({
			isOpen: preferences.activityPanelOpen,
			onOpenChange: (isOpen: boolean) => {
				void user.controller.setActivityPanelOpen(isOpen)
			},
			openedRoutine,
		}),
		[preferences.activityPanelOpen, user.controller, openedRoutine],
	)

	useTheme({ colorScheme: preferences.colorScheme })

	useWorkspaceShortcuts({
		isEnabled: !isOverlayOpen,
		onOpenUserSettings: sidebarActions.onOpenUserSettings,
		onStartConversation: startConversation,
	})

	return {
		activityPanel,
		isOverlayOpen,
		isThreadConversationSettingsOpen,
		isThreadSettingsOpen,
		search,
		toggleSettings,
		userSettings,
	}
}

export type WorkspaceOverlay = ReturnType<typeof useWorkspaceOverlay>
