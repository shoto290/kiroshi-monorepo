import type { RosterController } from "@/lib/bots/roster-controller"
import type { OpenedMissionController } from "@/lib/missions/opened-mission-controller"
import type { OpenedRoutineController } from "@/lib/routines/opened-routine-controller"
import type { SpacesController } from "@/lib/spaces/spaces-controller"
import type { UserController } from "@/lib/user/preferences-controller"

export type SearchRow = {
	kind: "bot" | "conversation"
	id: string
}

export type SearchTarget =
	| { kind: "chat"; row: SearchRow; spaceId: string | null }
	| { kind: "mission"; missionId: string; botId: string; spaceId: string }
	| {
			kind: "routine"
			routineId: string
			row: SearchRow
			conversationId: string
			spaceId: string
	  }

export type SearchNavigation = {
	selectBot: (botId: string) => void
	selectConversation: (conversationId: string) => void
	selectSpace: (spaceId: string) => void
	openMission: (opened: { missionId: string; rowId: string }) => void
	openRoutine: (opened: { routineId: string; conversationId: string }) => void
	openActivityPanel: () => void
}

const selectRow = (row: SearchRow, navigation: SearchNavigation) => {
	if (row.kind === "bot") {
		navigation.selectBot(row.id)
		return
	}
	navigation.selectConversation(row.id)
}

export const openSearchTarget = (
	target: SearchTarget,
	navigation: SearchNavigation,
) => {
	if (target.kind === "mission") {
		navigation.selectBot(target.botId)
		navigation.selectSpace(target.spaceId)
		navigation.openMission({
			missionId: target.missionId,
			rowId: target.botId,
		})
		return
	}

	selectRow(target.row, navigation)

	if (target.spaceId) {
		navigation.selectSpace(target.spaceId)
	}

	if (target.kind === "routine") {
		navigation.openActivityPanel()
		navigation.openRoutine({
			routineId: target.routineId,
			conversationId: target.conversationId,
		})
	}
}

export type SearchNavigationSource = {
	roster: Pick<RosterController, "select" | "selectConversation">
	spaces: Pick<SpacesController, "select">
	missions: Pick<OpenedMissionController, "open">
	routines: Pick<OpenedRoutineController, "open">
	user: Pick<UserController, "setActivityPanelOpen">
}

export const createSearchNavigation = ({
	roster,
	spaces,
	missions,
	routines,
	user,
}: SearchNavigationSource): SearchNavigation => ({
	selectBot: roster.select,
	selectConversation: roster.selectConversation,
	selectSpace: spaces.select,
	openMission: missions.open,
	openRoutine: routines.open,
	openActivityPanel: () => void user.setActivityPanelOpen(true),
})
