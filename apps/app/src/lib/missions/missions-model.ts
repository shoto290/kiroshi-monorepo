import type { AppSidebarRowMission } from "@workspace/ui/components/app-sidebar"
import type { BotBadge, BotMissionState } from "@workspace/ui/components/badge"
import type { MessageAuthor } from "@workspace/ui/components/message"
import type {
	MissionCardModel,
	MissionEventModel,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"
import type { RosterBot } from "@workspace/ui/components/roster"
import type {
	EarlierTodayRow,
	RoutinesPanelMissions,
} from "@workspace/ui/components/routines-panel"

import type {
	Mission,
	MissionEvent,
	MissionOnBoard,
	MissionState,
} from "./mission-contract"
import { toMissionFace } from "./mission-thread-model"

import { rosterTimestamp } from "@/lib/bots/roster-timestamp"
import type { ThreadFace } from "@/lib/chat/thread-contract"
import type { ReportedRunRead } from "@/lib/routines/routines-model"

const BADGE_BY_STATE: Record<MissionState, BotBadge | null> = {
	working: null,
	waiting_bot: null,
	waiting_human: "attention",
	ready_to_merge: "done",
	failed: "failed",
	done: null,
}

const TIME_OF_DAY = new Intl.DateTimeFormat("en-US", {
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
})

const startOfLocalDay = (now: number): number => {
	const day = new Date(now)
	day.setHours(0, 0, 0, 0)
	return day.getTime()
}

type MissionFaces = (botId: string) => ThreadFace | undefined

const toMissionRow = (
	mission: Mission,
	face: ThreadFace,
	timestamp: string,
): MissionRowModel => ({
	id: mission.id,
	objective: mission.objective,
	ticket: {
		platform: mission.ticket.platform,
		externalId: mission.ticket.externalId,
		title: mission.ticket.title,
	},
	bot: toMissionFace(face),
	state: mission.state,
	timestamp,
})

const rowsOf = (
	missions: Mission[],
	faceOf: MissionFaces,
	timestampOf: (mission: Mission) => string,
): MissionRowModel[] =>
	missions.flatMap((mission) => {
		const face = faceOf(mission.botId)
		return face ? [toMissionRow(mission, face, timestampOf(mission))] : []
	})

type EarlierTodayEntry = {
	at: number
	row: EarlierTodayRow
}

const closedTodayEntries = (
	closed: Mission[],
	faceOf: MissionFaces,
	midnight: number,
): EarlierTodayEntry[] =>
	closed.flatMap((mission) => {
		const face = faceOf(mission.botId)
		if (!face || mission.closedAt === null || mission.closedAt < midnight) {
			return []
		}

		return [
			{
				at: mission.closedAt,
				row: {
					kind: "mission",
					...toMissionRow(mission, face, TIME_OF_DAY.format(mission.closedAt)),
				},
			},
		]
	})

const reportedTodayEntries = (
	reportedRuns: ReportedRunRead[],
	faceOf: MissionFaces,
	midnight: number,
): EarlierTodayEntry[] =>
	reportedRuns.flatMap((run) => {
		const face = faceOf(run.botId)
		if (!face || run.at < midnight) {
			return []
		}

		return [
			{
				at: run.at,
				row: {
					kind: "run",
					id: run.id,
					routineTitle: run.routineTitle,
					triggerSourceTitle: run.triggerSourceTitle,
					bot: toMissionFace(face),
					timestamp: TIME_OF_DAY.format(run.at),
				},
			},
		]
	})

export type MissionRowsRead = {
	open: Mission[]
	closed: Mission[]
	reportedRuns: ReportedRunRead[]
	faceOf: MissionFaces
	now: number
}

export const toMissionRows = ({
	open,
	closed,
	reportedRuns,
	faceOf,
	now,
}: MissionRowsRead): Omit<RoutinesPanelMissions, "onOpen"> => {
	const midnight = startOfLocalDay(now)

	return {
		open: rowsOf(open, faceOf, (mission) =>
			rosterTimestamp(mission.openedAt, now),
		),
		earlierToday: [
			...closedTodayEntries(closed, faceOf, midnight),
			...reportedTodayEntries(reportedRuns, faceOf, midnight),
		]
			.sort((one, other) => other.at - one.at)
			.map((entry) => entry.row),
	}
}

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

export type MissionsByRow = Record<string, AppSidebarRowMission[]>

type MissionCarrier = {
	missions?: AppSidebarRowMission[]
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

type ShownMission = {
	state: BotMissionState
	mission: Mission
}

const mostUrgentFirst = (one: ShownMission, other: ShownMission): number =>
	MOST_URGENT_FIRST.indexOf(one.state) -
		MOST_URGENT_FIRST.indexOf(other.state) ||
	other.mission.openedAt - one.mission.openedAt ||
	(one.mission.id < other.mission.id ? -1 : 1)

const toRowMission = ({
	state,
	mission,
}: ShownMission): AppSidebarRowMission => ({
	id: mission.id,
	state,
	ticket: {
		platform: mission.ticket.platform,
		externalId: mission.ticket.externalId,
		title: mission.ticket.title,
	},
})

export const missionsByRow = (
	board: MissionOnBoard[],
	listedConversations: { id: string }[],
): MissionsByRow => {
	const listedConversationIds = new Set(
		listedConversations.map((conversation) => conversation.id),
	)
	const open: Record<string, ShownMission[]> = {}
	for (const { mission } of board) {
		if (mission.closedAt !== null) continue

		const state = CHIP_STATE_OF[mission.state]
		if (!state) continue

		const rowId = listedConversationIds.has(mission.originConversationId)
			? mission.originConversationId
			: mission.botId
		open[rowId] = [...(open[rowId] ?? []), { state, mission }]
	}

	return Object.fromEntries(
		Object.entries(open).map(([rowId, held]) => [
			rowId,
			[...held].sort(mostUrgentFirst).map(toRowMission),
		]),
	)
}

export const withMissions = <Row extends MissionCarrier & { id: string }>(
	rows: Row[],
	missions: MissionsByRow,
): Row[] =>
	rows.map((row) =>
		missions[row.id] ? { ...row, missions: missions[row.id] } : row,
	)

export const missionRingBadges = (
	rowsBySpaceId: Record<string, MissionCarrier[]>,
): Record<string, { badge?: BotBadge }[]> =>
	Object.fromEntries(
		Object.entries(rowsBySpaceId).map(([spaceId, rows]) => [
			spaceId,
			rows.map((row) => ({
				badge: row.missions?.[0] && RING_BADGE_OF[row.missions[0].state],
			})),
		]),
	)
