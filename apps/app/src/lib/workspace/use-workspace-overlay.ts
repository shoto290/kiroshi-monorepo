import { useCallback, useMemo } from "react"

import { useSettingsShortcut } from "@workspace/ui/hooks/use-settings-shortcut"

import type { ApplicationScopes } from "./use-application-scopes"
import type { RosterLines } from "./use-roster-lines"
import type { RosterView } from "./use-roster-view"
import type { WorkspaceCore } from "./use-workspace-core"

import {
	useSearch,
	useSearchLookups,
	useSearchNavigation,
} from "../search/use-search"
import { useTheme } from "../theme/use-theme"
import type { ColorScheme } from "../user/preferences-contract"
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
	const { now } = rosterLines
	const {
		conversationRosters,
		isEditing,
		isEditingConversation,
		selected,
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

	const changeSidebarWidth = useCallback(
		(sidebarWidth: number) => {
			void user.controller.setSidebarWidth(sidebarWidth)
		},
		[user.controller],
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

	const changeColorScheme = useCallback(
		(colorScheme: ColorScheme) => {
			void user.controller.setColorScheme(colorScheme)
		},
		[user.controller],
	)

	useTheme({
		colorScheme: preferences.colorScheme,
		onColorSchemeChange: changeColorScheme,
	})

	useSettingsShortcut({
		isEnabled: Boolean(selected) && !isEditing && !search.isOpen,
		onToggle: toggleSettings,
	})

	return {
		activityPanel,
		changeSidebarWidth,
		isOverlayOpen,
		isThreadConversationSettingsOpen,
		isThreadSettingsOpen,
		search,
		toggleSettings,
		userSettings,
	}
}

export type WorkspaceOverlay = ReturnType<typeof useWorkspaceOverlay>
