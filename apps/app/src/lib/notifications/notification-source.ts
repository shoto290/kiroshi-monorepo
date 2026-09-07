import type { NoticeMessage } from "@workspace/ui/components/notice-surface"

import {
	type ConversationRound,
	type NotificationSwitches,
	notificationsFor,
	notifiesAskedQuestion,
	notifiesFinishedRound,
	notifiesMission,
} from "./notification-policy"
import type {
	NotificationPort,
	NotificationRequest,
	NotificationTarget,
} from "./notification-port"
import {
	isNotifiedMissionState,
	missionNotificationWordsFor,
	missionQuestionWordsFor,
	type NotificationFailure,
	notificationFailureTitleFor,
	notificationWordsFor,
} from "./notification-words"

import type { ChatState } from "../chat/chat-state"
import { conversationName } from "../conversations/roster-conversations"
import type { Conversation } from "../conversations/store-contract"
import type {
	Mission,
	MissionChanged,
	MissionDetail,
	MissionOnBoard,
} from "../missions/mission-contract"
import { createMissionStates } from "../missions/mission-states"
import type { OpenedMission } from "../missions/opened-mission-controller"
import type { UserPreferences } from "../user/preferences-contract"

type NotifiedBot = {
	id: string
	name: string
}

type ChatSource = {
	stateFor: (botId: string) => ChatState
	subscribe: (listener: () => void) => () => void
}

type RuntimeSource = {
	heldFor: (
		conversationId: string,
	) => { getState: () => ConversationRound } | null
	subscribe: (listener: () => void) => () => void
}

type RosterSource = {
	getState: () => {
		rosters: Record<string, NotifiedBot[]>
		conversations: Conversation[]
	}
	spaceOfConversation: (conversationId: string) => string | undefined
	select: (botId: string) => void
	selectConversation: (conversationId: string) => void
}

type SpacesSource = {
	select: (spaceId: string) => void
}

type MissionsSource = {
	board: () => Promise<Pick<MissionOnBoard, "mission">[]>
	onChanged: (
		listener: (changed: MissionChanged) => void,
	) => Promise<() => void>
	detail: (missionId: string) => Promise<MissionDetail>
	open: (opened: OpenedMission) => void
}

export type NotificationSourceSwitches = NotificationSwitches &
	Pick<UserPreferences, "notifyWithSound">

export type FailureNoticeReporter = (notice: NoticeMessage) => void

export type NotificationSourceOptions = {
	chat: ChatSource
	runtimes: RuntimeSource
	roster: RosterSource
	spaces: SpacesSource
	missions: MissionsSource
	notifications: NotificationPort
	switches: () => NotificationSourceSwitches
	hasFocus: () => boolean
	watchFocus: (report: (isFocused: boolean) => void) => Promise<() => void>
	raiseWindow: () => Promise<void>
	playChime: () => void
	reportFailure: FailureNoticeReporter
}

type Reading = {
	switches: NotificationSourceSwitches
	hasFocus: boolean
}

const reasonOf = (reason: unknown): string =>
	reason instanceof Error ? reason.message : String(reason)

const forgetBeyond = <Held>(seen: Map<string, Held>, ids: string[]) => {
	if (seen.size <= ids.length) {
		return
	}
	for (const id of seen.keys()) {
		if (!ids.includes(id)) {
			seen.delete(id)
		}
	}
}

export const startNotificationSource = ({
	chat,
	runtimes,
	roster,
	spaces,
	missions,
	notifications,
	switches,
	hasFocus,
	watchFocus,
	raiseWindow,
	playChime,
	reportFailure,
}: NotificationSourceOptions): (() => void) => {
	const seen = new Map<string, ChatState>()
	const seenRounds = new Map<string, ConversationRound>()
	const missionThreads = new Map<string, Mission>()
	const missionStates = createMissionStates()

	let windowFocus: boolean | undefined

	const reportedFailures = new Set<NotificationFailure>()

	const failWith =
		(failure: NotificationFailure) =>
		(reason: unknown): undefined => {
			if (reportedFailures.has(failure)) {
				return
			}
			reportedFailures.add(failure)
			reportFailure({
				title: notificationFailureTitleFor(failure),
				description: reasonOf(reason),
			})
		}

	const rosteredBots = (): NotifiedBot[] => {
		const held = new Map<string, NotifiedBot>()
		for (const bots of Object.values(roster.getState().rosters)) {
			for (const bot of bots) {
				held.set(bot.id, bot)
			}
		}
		return [...held.values()]
	}

	const botNotifications = ({
		switches,
		hasFocus,
	}: Reading): NotificationRequest[] => {
		const bots = rosteredBots()
		const requests: NotificationRequest[] = []

		for (const bot of bots) {
			const after = chat.stateFor(bot.id)
			const before = seen.get(bot.id)
			seen.set(bot.id, after)

			if (!before) {
				continue
			}

			const changes = notificationsFor({
				botId: bot.id,
				before,
				after,
				switches,
				hasFocus,
			})

			for (const change of changes) {
				requests.push({
					target: { kind: "bot", id: bot.id },
					...notificationWordsFor({ name: bot.name, event: change.event }),
				})
			}
		}

		forgetBeyond(
			seen,
			bots.map((bot) => bot.id),
		)
		return requests
	}

	const roundChangeOf = (conversationId: string) => {
		const held = runtimes.heldFor(conversationId)

		if (!held) {
			seenRounds.delete(conversationId)
			return null
		}

		const after = held.getState()
		const before = seenRounds.get(conversationId)
		seenRounds.set(conversationId, after)

		return before ? { before, after } : null
	}

	const conversationNotifications = (
		conversations: Conversation[],
		reading: Reading,
	): NotificationRequest[] =>
		conversations.flatMap((conversation) => {
			const change = roundChangeOf(conversation.id)

			if (!change || !notifiesFinishedRound({ ...change, ...reading })) {
				return []
			}

			return [
				{
					target: { kind: "conversation" as const, id: conversation.id },
					...notificationWordsFor({
						name: conversationName(conversation),
						event: "finishedTurn",
					}),
				},
			]
		})

	const botNameOf = (botId: string) =>
		rosteredBots().find(({ id }) => id === botId)?.name

	const missionThreadNotifications = (
		reading: Reading,
	): NotificationRequest[] =>
		[...missionThreads.values()].flatMap((mission) => {
			const change = roundChangeOf(mission.threadConversationId)
			const name = botNameOf(mission.botId)

			if (
				!change ||
				!name ||
				!notifiesAskedQuestion({ ...change, ...reading })
			) {
				return []
			}

			return [
				{
					target: { kind: "mission" as const, id: mission.id },
					...missionQuestionWordsFor({
						name,
						ticket: mission.ticket.externalId,
					}),
				},
			]
		})

	const spaceOfBotThread = (botId: string) => {
		const { conversationId } = chat.stateFor(botId)
		return conversationId
			? roster.spaceOfConversation(conversationId)
			: undefined
	}

	const currentFocus = (): boolean => windowFocus ?? hasFocus()

	const compare = () => {
		const reading: Reading = {
			switches: switches(),
			hasFocus: currentFocus(),
		}
		const { conversations } = roster.getState()
		const requests = [
			...botNotifications(reading),
			...conversationNotifications(conversations, reading),
			...missionThreadNotifications(reading),
		]

		forgetBeyond(seenRounds, [
			...conversations.map((conversation) => conversation.id),
			...missionThreads.keys(),
		])

		for (const request of requests) {
			void notifications.send(request).catch(failWith("send"))
		}

		if (requests.length > 0 && reading.switches.notifyWithSound) {
			playChime()
		}
	}

	const holdMissionThread = (mission: Mission) => {
		if (mission.closedAt === null) {
			missionThreads.set(mission.threadConversationId, mission)
			return
		}

		missionThreads.delete(mission.threadConversationId)
	}

	const missionChanged = async (changed: MissionChanged) => {
		if (!missionStates.entered(changed)) {
			return
		}

		missionStates.remember(changed)

		const { mission } = await missions.detail(changed.missionId)
		holdMissionThread(mission)

		const { state } = changed

		if (!isNotifiedMissionState(state)) {
			return
		}

		const reading: Reading = {
			switches: switches(),
			hasFocus: currentFocus(),
		}

		if (!notifiesMission({ state, ...reading })) {
			return
		}

		const name = botNameOf(mission.botId)

		if (!name) {
			return
		}

		void notifications
			.send({
				target: { kind: "mission", id: mission.id },
				...missionNotificationWordsFor({
					name,
					ticket: mission.ticket.externalId,
					state,
				}),
			})
			.catch(failWith("send"))

		if (reading.switches.notifyWithSound) {
			playChime()
		}
	}

	const catchUpOnMissionThreads = async () => {
		for (const { mission } of await missions.board()) {
			holdMissionThread(mission)
		}
	}

	const openMission = async (missionId: string) => {
		const { mission } = await missions.detail(missionId)
		const spaceId = roster.spaceOfConversation(mission.originConversationId)

		if (!spaceId) {
			return
		}

		roster.select(mission.botId)
		spaces.select(spaceId)
		missions.open({ missionId, rowId: mission.botId })
	}

	const windowRaised = (): Promise<void> => {
		try {
			return raiseWindow()
		} catch (reason) {
			return Promise.reject(reason)
		}
	}

	const landOnBot = (botId: string) => {
		const spaceId = spaceOfBotThread(botId)

		if (!spaceId) {
			return
		}

		roster.select(botId)
		spaces.select(spaceId)
	}

	const landOnConversation = (conversationId: string) => {
		const spaceId = roster.spaceOfConversation(conversationId)

		if (!spaceId) {
			return
		}

		roster.selectConversation(conversationId)
		spaces.select(spaceId)
	}

	const activate = ({ kind, id }: NotificationTarget) => {
		void windowRaised().catch(failWith("reveal"))

		if (kind === "mission") {
			return void openMission(id).catch(failWith("clicks"))
		}

		if (kind === "bot") {
			return landOnBot(id)
		}

		landOnConversation(id)
	}

	const stopChat = chat.subscribe(compare)
	const stopRuntimes = runtimes.subscribe(compare)
	const missionChanges = missions
		.onChanged(
			(changed) => void missionChanged(changed).catch(failWith("send")),
		)
		.catch(failWith("send"))
	void catchUpOnMissionThreads().catch(failWith("send"))
	const focus = watchFocus((isFocused) => {
		windowFocus = isFocused
	}).catch(failWith("focus"))
	const activation = notifications
		.onActivate(activate)
		.catch(failWith("clicks"))

	return () => {
		stopChat()
		stopRuntimes()
		void missionChanges.then((stop) => stop?.())
		void focus.then((stop) => stop?.())
		void activation.then((stop) => stop?.())
	}
}
