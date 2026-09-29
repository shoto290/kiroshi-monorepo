import { useCallback, useMemo, useSyncExternalStore } from "react"

import type { MissionsPanelProps } from "@workspace/ui/components/missions-panel"

import {
	type StoppableRuntimes,
	useMissionCardMenus,
} from "@/components/mission-card-menu"
import type { RosterController } from "../bots/roster-controller"
import { faceOfBot } from "../chat/thread-contract"
import type { Bot, Conversation } from "../conversations/store-contract"
import type { MissionLanding } from "../missions/mission-actions"
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
	conversationRuntimes: MissionSpeakingRuntimes & StoppableRuntimes
	openedMission: Pick<
		OpenedMissionController,
		"open" | "getState" | "subscribe"
	>
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

const entriesOf = ({
	waitingOnYou,
	inProgress,
	earlierToday,
}: SpaceMissionGroups) => [...waitingOnYou, ...inProgress, ...earlierToday]

export const useSidebarMissions = ({
	core,
	rosterLines,
}: SidebarMissionsInput): SidebarMissions => {
	const { conversationRuntimes, openedMission, roster, spaces } = core
	const { now } = rosterLines
	const spaceId = spaces.state.selectedSpaceId
	const feed = useSpaceMissions(spaceId)
	useSpaceMissionsFailure(feed.hasFailed, feed.reload)

	const entries = useMemo(() => entriesOf(feed), [feed])
	const missions = useMemo(
		() => entries.map(({ mission }) => mission),
		[entries],
	)
	const opened = useSyncExternalStore(
		openedMission.subscribe,
		openedMission.getState,
	)
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
		(missionId: string, landing?: MissionLanding) => {
			const entry = entries.find(({ mission }) => mission.id === missionId)
			if (!entry) {
				return
			}
			const { mission, conversationId } = entry
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
			openedMission.open({ missionId, rowId, landing })
		},
		[entries, listedConversationIds, roster.controller, openedMission],
	)

	const wrap = useMissionCardMenus({
		missions,
		runtimes: conversationRuntimes,
		onOpenMission: openMission,
		onChanged: feed.reload,
	})

	const panel = useMemo(
		() => ({
			...toMissionsPanel({
				groups: feed,
				faceOf: (botId) => faces.get(botId),
				liveMissionIds,
				now,
			}),
			onOpen: (missionId: string) => openMission(missionId),
			openMissionId: opened?.missionId ?? null,
			wrap,
		}),
		[feed, faces, liveMissionIds, now, openMission, opened, wrap],
	)

	return { panel, waitingCount: feed.waitingCount }
}
