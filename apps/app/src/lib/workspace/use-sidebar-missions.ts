import { useCallback, useMemo } from "react"

import type { MissionsPanelProps } from "@workspace/ui/components/missions-panel"

import type { RosterController } from "../bots/roster-controller"
import { faceOfBot } from "../chat/thread-contract"
import type { Bot } from "../conversations/store-contract"
import {
	type SpaceMissionGroups,
	toMissionsPanel,
} from "../missions/missions-model"
import type { OpenedMissionController } from "../missions/opened-mission-controller"
import {
	type MissionSpeakingRuntimes,
	useLiveMissions,
} from "../missions/use-live-missions"
import { useSpaceMissionsFailure } from "../missions/use-mission-failure-notices"
import { useSpaceMissions } from "../missions/use-space-missions"

type SidebarMissionsCore = {
	conversationRuntimes: MissionSpeakingRuntimes
	openedMission: Pick<OpenedMissionController, "open">
	roster: {
		state: { rosters: Record<string, Bot[]> }
		controller: Pick<RosterController, "selectConversation">
	}
	spaces: { state: { selectedSpaceId: string | null } }
}

type SidebarMissionsInput = {
	core: SidebarMissionsCore
	rosterLines: { now: number }
}

export type SidebarMissions = {
	panel: MissionsPanelProps
	waitingCount: number
}

const facesOf = (rosters: Record<string, Bot[]>) =>
	new Map(
		Object.values(rosters).flatMap((bots) =>
			bots.map((bot) => [bot.id, faceOfBot(bot)] as const),
		),
	)

const missionsOf = ({
	waitingOnYou,
	inProgress,
	earlierToday,
}: SpaceMissionGroups) =>
	[...waitingOnYou, ...inProgress, ...earlierToday].map(
		({ mission }) => mission,
	)

export const useSidebarMissions = ({
	core,
	rosterLines,
}: SidebarMissionsInput): SidebarMissions => {
	const { conversationRuntimes, openedMission, roster, spaces } = core
	const { now } = rosterLines
	const feed = useSpaceMissions(spaces.state.selectedSpaceId)
	useSpaceMissionsFailure(feed.hasFailed, feed.reload)

	const missions = useMemo(() => missionsOf(feed), [feed])
	const liveMissionIds = useLiveMissions(conversationRuntimes, missions, now)
	const faces = useMemo(
		() => facesOf(roster.state.rosters),
		[roster.state.rosters],
	)

	const openMission = useCallback(
		(missionId: string, conversationId: string) => {
			roster.controller.selectConversation(conversationId)
			openedMission.open({ missionId, rowId: conversationId })
		},
		[roster.controller, openedMission],
	)

	const panel = useMemo(
		() => ({
			...toMissionsPanel({
				groups: feed,
				faceOf: (botId) => faces.get(botId),
				liveMissionIds,
				now,
			}),
			onOpen: openMission,
		}),
		[feed, faces, liveMissionIds, now, openMission],
	)

	return { panel, waitingCount: feed.waitingCount }
}
