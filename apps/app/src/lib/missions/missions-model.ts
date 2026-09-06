import type { AppSidebarBotMission } from "@workspace/ui/components/app-sidebar"
import type { BotBadge, BotMissionState } from "@workspace/ui/components/badge"
import type { MessageAuthor } from "@workspace/ui/components/message"
import type {
	MissionCardModel,
	MissionEventModel,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"
import type { RosterBot } from "@workspace/ui/components/roster"

import type {
	Mission,
	MissionEvent,
	MissionOnBoard,
	MissionState,
} from "./mission-contract"

const BADGE_BY_STATE: Record<MissionState, BotBadge | null> = {
	working: null,
	waiting_bot: null,
	waiting_human: "attention",
	ready_to_merge: "done",
	failed: "failed",
	done: null,
}

export const toMissionRows = (missions: Mission[]): MissionRowModel[] =>
	missions.map((mission) => ({
		id: mission.id,
		objective: mission.objective,
		ticketId: mission.ticket.externalId,
		tools: mission.tools,
		openedAt: mission.openedAt,
		badge: BADGE_BY_STATE[mission.state],
	}))

export const toMissionCard = (
	mission: Mission,
	identity: RosterBot,
	author: MessageAuthor | undefined,
): MissionCardModel => ({
	id: mission.id,
	identity,
	author,
	objective: mission.objective,
	ticket: {
		externalId: mission.ticket.externalId,
		title: mission.ticket.title,
		platform: mission.ticket.platform,
		url: mission.ticket.url,
	},
	tools: mission.tools,
	state: mission.state,
	isClosed: mission.closedAt !== null,
})

const spokenTextOf = (payload: unknown): string | undefined => {
	if (typeof payload !== "object" || payload === null) {
		return undefined
	}

	const { text } = payload as { text?: unknown }

	return typeof text === "string" ? text : undefined
}

export const toMissionEventModels = (
	events: MissionEvent[],
): MissionEventModel[] =>
	events.map((event) => ({
		id: event.id,
		kind: event.kind,
		source: event.source,
		createdAt: event.createdAt,
		text: spokenTextOf(event.payload),
	}))

export type MissionsByRow = Record<string, AppSidebarBotMission>

type MissionCarrier = {
	mission?: AppSidebarBotMission
}

const CHIP_STATE_OF: Partial<Record<MissionState, BotMissionState>> = {
	waiting_human: "waiting",
	failed: "failed",
	ready_to_merge: "ready",
	working: "working",
	waiting_bot: "working",
}

const MOST_URGENT_FIRST: BotMissionState[] = [
	"waiting",
	"failed",
	"ready",
	"working",
]

const RING_BADGE_OF: Partial<Record<BotMissionState, BotBadge>> =
	Object.fromEntries(
		Object.entries(CHIP_STATE_OF).flatMap(([state, chip]) => {
			const badge = BADGE_BY_STATE[state as MissionState]
			return badge ? [[chip, badge]] : []
		}),
	)

const urgencyOf = (state: BotMissionState) => MOST_URGENT_FIRST.indexOf(state)

const isMoreUrgent = (candidate: ShownMission, held: ShownMission): boolean => {
	if (candidate.state !== held.state)
		return urgencyOf(candidate.state) < urgencyOf(held.state)
	if (candidate.mission.openedAt !== held.mission.openedAt)
		return candidate.mission.openedAt < held.mission.openedAt
	return candidate.mission.id < held.mission.id
}

type ShownMission = {
	state: BotMissionState
	mission: Mission
}

export const missionsByRow = (
	board: MissionOnBoard[],
	listedConversations: { id: string }[],
): MissionsByRow => {
	const listedConversationIds = new Set(
		listedConversations.map((conversation) => conversation.id),
	)
	const shown: Record<string, ShownMission> = {}
	const openCount: Record<string, number> = {}
	for (const { mission } of board) {
		const state = CHIP_STATE_OF[mission.state]
		if (!state) continue

		const rowId = listedConversationIds.has(mission.originConversationId)
			? mission.originConversationId
			: mission.botId
		openCount[rowId] = (openCount[rowId] ?? 0) + 1

		const held = shown[rowId]
		const candidate = { state, mission }
		if (!held || isMoreUrgent(candidate, held)) shown[rowId] = candidate
	}

	return Object.fromEntries(
		Object.entries(shown).map(([rowId, { state, mission }]) => [
			rowId,
			{
				state,
				ticket: {
					platform: mission.ticket.platform,
					externalId: mission.ticket.externalId,
					title: mission.ticket.title,
				},
				otherCount: openCount[rowId] - 1,
			},
		]),
	)
}

export const withMissions = <Row extends MissionCarrier & { id: string }>(
	rows: Row[],
	missions: MissionsByRow,
): Row[] =>
	rows.map((row) =>
		missions[row.id] ? { ...row, mission: missions[row.id] } : row,
	)

export const missionRingBadges = (
	rowsBySpaceId: Record<string, MissionCarrier[]>,
): Record<string, { badge?: BotBadge }[]> =>
	Object.fromEntries(
		Object.entries(rowsBySpaceId).map(([spaceId, rows]) => [
			spaceId,
			rows.map((row) => ({
				badge: row.mission && RING_BADGE_OF[row.mission.state],
			})),
		]),
	)
