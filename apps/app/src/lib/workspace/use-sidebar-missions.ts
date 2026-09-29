import { useCallback, useMemo } from "react"

import type { MissionsPanelProps } from "@workspace/ui/components/missions-panel"

import type { RosterController } from "../bots/roster-controller"
import { faceOfBot } from "../chat/thread-contract"
import type { Bot, Conversation } from "../conversations/store-contract"
import {
	missionRowIdOf,
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
		state: {
			rosters: Record<string, Bot[]>
			conversationRosters: Record<string, Conversation[]>
		}
		controller: Pick<RosterController, "select" | "selectConversation">
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

const listedConversationIdsOf = (
	conversationRosters: Record<string, Conversation[]>,
	spaceId: string | null,
) =>
	new Set(
		(spaceId === null ? [] : (conversationRosters[spaceId] ?? [])).map(
			({ id }) => id,
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
	const spaceId = spaces.state.selectedSpaceId
	const feed = useSpaceMissions(spaceId)
	useSpaceMissionsFailure(feed.hasFailed, feed.reload)

	const missions = useMemo(() => missionsOf(feed), [feed])
	const liveMissionIds = useLiveMissions(conversationRuntimes, missions, now)
	const faces = useMemo(
		() => facesOf(roster.state.rosters),
		[roster.state.rosters],
	)

	const listedConversationIds = useMemo(
		() => listedConversationIdsOf(roster.state.conversationRosters, spaceId),
		[roster.state.conversationRosters, spaceId],
	)

	const openMission = useCallback(
		(missionId: string, conversationId: string) => {
			const mission = missions.find(({ id }) => id === missionId)
			if (!mission) {
				return
			}
			const rowId = missionRowIdOf(
				conversationId,
				mission.botId,
				listedConversationIds,
			)
			if (rowId === conversationId) {
				roster.controller.selectConversation(rowId)
			} else {
				roster.controller.select(rowId)
			}
			openedMission.open({ missionId, rowId })
		},
		[missions, listedConversationIds, roster.controller, openedMission],
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
