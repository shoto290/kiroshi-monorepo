import type { AppSidebarRowMission } from "@workspace/ui/components/app-sidebar"
import type {
	BotBadge,
	BotMissionState,
} from "@workspace/ui/components/bot-badge"
import type { MessageAuthor } from "@workspace/ui/components/message"
import type {
	MissionActivity,
	MissionCardModel,
	MissionEventLink,
	MissionEventModel,
	MissionPullRequest,
	MissionEventKind as ShownEventKind,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"
import type { RosterBot } from "@workspace/ui/components/roster"
import type {
	EarlierTodayRow,
	RoutinesPanelMissions,
} from "@workspace/ui/components/routines-panel"
import { formatDateTime } from "@workspace/ui/lib/time-format"

import type {
	Mission,
	MissionChanged,
	MissionEvent,
	MissionOnBoard,
	MissionState,
} from "./mission-contract"
import { toMissionFace } from "./mission-thread-model"

import type { SoloThreads } from "@/lib/bots/roster-line"
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

export const badgeOfMissionState = (state: MissionState): BotBadge | null =>
	BADGE_BY_STATE[state]

export type WaitingMissionIds = ReadonlySet<string>

const NO_WAITING_MISSIONS: WaitingMissionIds = new Set()

export const AGENT_SILENCE_MS = 2 * 60 * 1000

export type LiveMissionIds = ReadonlySet<string>

type SpeakingBotIds = Record<string, string[]>

export type MissionLivenessRead = {
	missions: Mission[]
	speakingBotIds: SpeakingBotIds
	now: number
}

const isOpen = (mission: Mission): boolean => mission.closedAt === null

const speaksOnItsThread = (
	mission: Mission,
	speakingBotIds: SpeakingBotIds,
): boolean =>
	speakingBotIds[mission.threadConversationId]?.includes(mission.botId) ?? false

const hasAgentActivity = (mission: Mission, now: number): boolean =>
	mission.lastActivityAt === null
		? mission.isAgentRunning
		: now - mission.lastActivityAt < AGENT_SILENCE_MS

const isLive = (
	mission: Mission,
	{ speakingBotIds, now }: MissionLivenessRead,
): boolean =>
	isOpen(mission) &&
	(speaksOnItsThread(mission, speakingBotIds) || hasAgentActivity(mission, now))

export const liveMissionsIn = (read: MissionLivenessRead): LiveMissionIds =>
	new Set(
		read.missions
			.filter((mission) => isLive(mission, read))
			.map(({ id }) => id),
	)

export const withMissionChange = (
	mission: Mission,
	{ lastActivityAt, isAgentRunning }: MissionChanged,
): Mission => ({ ...mission, lastActivityAt, isAgentRunning })

const WAITING_ON_READER: MissionState = "waiting_human"

const shownStateOf = (
	mission: Mission,
	waitingMissionIds: WaitingMissionIds,
): MissionState =>
	waitingMissionIds.has(mission.id) ? WAITING_ON_READER : mission.state

const TIME_OF_DAY: Intl.DateTimeFormatOptions = {
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
}

const startOfLocalDay = (now: number): number => {
	const day = new Date(now)
	day.setHours(0, 0, 0, 0)
	return day.getTime()
}

type MissionFaces = (botId: string) => ThreadFace | undefined

type AgentActivity = {
	lastActivity?: MissionActivity
	lastActivityAt?: number
	commitsAhead?: number
}

const agentActivityOf = (mission: Mission): AgentActivity => ({
	lastActivity: mission.lastActivity ?? undefined,
	lastActivityAt: mission.lastActivityAt ?? undefined,
	commitsAhead: mission.commitsAhead ?? undefined,
})

type MissionRowRead = {
	mission: Mission
	face: ThreadFace
	timestamp: string
	state: MissionState
	isWorking: boolean
	now: number
}

const toMissionRow = ({
	mission,
	face,
	timestamp,
	state,
	isWorking,
	now,
}: MissionRowRead): MissionRowModel => ({
	id: mission.id,
	objective: mission.objective,
	ticket: {
		platform: mission.ticket.platform,
		externalId: mission.ticket.externalId,
		title: mission.ticket.title,
	},
	bot: toMissionFace(face),
	state,
	isWorking,
	timestamp,
	now,
})

const rowsOf = (
	missions: Mission[],
	faceOf: MissionFaces,
	waitingMissionIds: WaitingMissionIds,
	liveMissionIds: LiveMissionIds,
	now: number,
): MissionRowModel[] =>
	missions.flatMap((mission) => {
		const face = faceOf(mission.botId)
		return face
			? [
					{
						...toMissionRow({
							mission,
							face,
							timestamp: rosterTimestamp(
								mission.lastActivityAt ?? mission.openedAt,
								now,
							),
							state: shownStateOf(mission, waitingMissionIds),
							isWorking: liveMissionIds.has(mission.id),
							now,
						}),
						...agentActivityOf(mission),
					},
				]
			: []
	})

type EarlierTodayEntry = {
	at: number
	row: EarlierTodayRow
}

const closedTodayEntries = (
	closed: Mission[],
	faceOf: MissionFaces,
	midnight: number,
	now: number,
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
					...toMissionRow({
						mission,
						face,
						timestamp: formatDateTime(mission.closedAt, TIME_OF_DAY),
						state: mission.state,
						isWorking: false,
						now,
					}),
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
					timestamp: formatDateTime(run.at, TIME_OF_DAY),
				},
			},
		]
	})

export type MissionRowsRead = {
	open: Mission[]
	closed: Mission[]
	reportedRuns: ReportedRunRead[]
	faceOf: MissionFaces
	waitingMissionIds: WaitingMissionIds
	liveMissionIds: LiveMissionIds
	now: number
}

export const toMissionRows = ({
	open,
	closed,
	reportedRuns,
	faceOf,
	waitingMissionIds,
	liveMissionIds,
	now,
}: MissionRowsRead): Omit<RoutinesPanelMissions, "onOpen"> => {
	const midnight = startOfLocalDay(now)

	return {
		open: rowsOf(open, faceOf, waitingMissionIds, liveMissionIds, now),
		earlierToday: [
			...closedTodayEntries(closed, faceOf, midnight, now),
			...reportedTodayEntries(reportedRuns, faceOf, midnight),
		]
			.sort((one, other) => other.at - one.at)
			.map((entry) => entry.row),
	}
}

export type MissionCardRead = {
	mission: Mission
	identity: RosterBot
	author: MessageAuthor | undefined
	isWorking: boolean
}

export const toMissionCard = ({
	mission,
	identity,
	author,
	isWorking,
}: MissionCardRead): MissionCardModel => ({
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
	isWorking,
	isClosed: mission.closedAt !== null,
})

export type MissionHeaderActivity = AgentActivity & {
	pullRequest?: MissionPullRequest
}

const PULL_REQUEST_NUMBER = /^\d+$/

const pullRequestOf = (url: string | null): MissionPullRequest | undefined => {
	const lastSegment = url?.split("/").at(-1)
	if (!url || !lastSegment || !PULL_REQUEST_NUMBER.test(lastSegment)) {
		return undefined
	}

	return { url, number: Number(lastSegment) }
}

export const toMissionHeaderActivity = (
	mission: Mission,
): MissionHeaderActivity => ({
	...agentActivityOf(mission),
	pullRequest: pullRequestOf(mission.pullRequestUrl),
})

const SPOKEN_KEYS = ["line", "message", "question", "summary"] as const

const payloadRecordOf = (
	payload: unknown,
): Record<string, unknown> | undefined =>
	typeof payload === "object" && payload !== null
		? (payload as Record<string, unknown>)
		: undefined

const spokenTextOf = (payload: unknown): string | undefined => {
	const held = payloadRecordOf(payload)
	if (!held) {
		return undefined
	}

	return SPOKEN_KEYS.map((key) => held[key]).find(
		(value): value is string => typeof value === "string" && value.length > 0,
	)
}

const linkOf = (payload: unknown): MissionEventLink | undefined => {
	const held = payloadRecordOf(payload)
	if (typeof held?.url !== "string") {
		return undefined
	}

	return typeof held.pullRequest === "number"
		? { url: held.url, pullRequest: held.pullRequest }
		: { url: held.url }
}

const SHOWN_EVENT_KINDS: Record<ShownEventKind, true> = {
	opened: true,
	note: true,
	agent_asked: true,
	answered: true,
	escalated: true,
	ready: true,
	checks_failed: true,
	failed: true,
	closed: true,
}

const isShown = (
	event: MissionEvent,
): event is MissionEvent & { kind: ShownEventKind } =>
	event.kind in SHOWN_EVENT_KINDS

export const toMissionEventModels = (
	events: MissionEvent[],
): MissionEventModel[] =>
	events.filter(isShown).map((event) => ({
		id: event.id,
		kind: event.kind,
		source: event.source,
		createdAt: event.createdAt,
		text: spokenTextOf(event.payload),
		link: linkOf(event.payload),
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
	waitingMissionIds: WaitingMissionIds = NO_WAITING_MISSIONS,
): MissionsByRow => {
	const listedConversationIds = new Set(
		listedConversations.map((conversation) => conversation.id),
	)
	const open: Record<string, ShownMission[]> = {}
	for (const { mission } of board) {
		if (mission.closedAt !== null) continue

		const state = CHIP_STATE_OF[shownStateOf(mission, waitingMissionIds)]
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

const NO_MISSIONS: MissionsByRow = {}

const conversationSpaces = (
	conversationRosters: Record<string, { id: string }[]>,
	soloThreads: SoloThreads,
): Map<string, string> => {
	const spaces = new Map<string, string>()
	for (const [conversationId, line] of Object.entries(soloThreads)) {
		spaces.set(conversationId, line.spaceId)
	}
	for (const [spaceId, conversations] of Object.entries(conversationRosters)) {
		for (const { id } of conversations) {
			spaces.set(id, spaceId)
		}
	}
	return spaces
}

export type MissionSpaces = {
	board: MissionOnBoard[]
	conversationRosters: Record<string, { id: string }[]>
	soloThreads: SoloThreads
	waitingMissionIds?: WaitingMissionIds
}

export const missionsBySpaceId = ({
	board,
	conversationRosters,
	soloThreads,
	waitingMissionIds,
}: MissionSpaces): Record<string, MissionsByRow> => {
	const spaces = conversationSpaces(conversationRosters, soloThreads)
	const listed: Record<string, MissionOnBoard[]> = {}
	for (const onBoard of board) {
		const spaceId = spaces.get(onBoard.mission.originConversationId)
		if (!spaceId) continue
		listed[spaceId] = [...(listed[spaceId] ?? []), onBoard]
	}

	return Object.fromEntries(
		Object.entries(listed).map(([spaceId, held]) => [
			spaceId,
			missionsByRow(
				held,
				conversationRosters[spaceId] ?? [],
				waitingMissionIds,
			),
		]),
	)
}

export const missionsIn = (
	missions: Record<string, MissionsByRow>,
	spaceId: string | null,
): MissionsByRow =>
	spaceId === null ? NO_MISSIONS : (missions[spaceId] ?? NO_MISSIONS)

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
