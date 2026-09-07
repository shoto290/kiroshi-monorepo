import { type BadgeSource, createBadgeSource } from "./badge-source"
import { badgeAfter } from "./bot-badge"
import type { ChatState } from "./chat-state"

import {
	rosterLineKey,
	rosterLineOf,
	rosterLinesIn,
	runsIn,
	type SoloThreads,
} from "../bots/roster-line"

type BadgedBot = {
	id: string
}

type ChatSource = {
	stateFor: (botId: string) => ChatState
	subscribe: (listener: () => void) => () => void
}

type RosterSource = {
	getState: () => {
		rosters: Record<string, BadgedBot[]>
		soloThreads: SoloThreads
		spaceId: string | null
		selectedBotId: string | null
	}
	subscribe: (listener: () => void) => () => void
}

export type BotBadgeSourceOptions = {
	chat: ChatSource
	roster: RosterSource
	hasFocus: () => boolean
	watchFocus: (report: (isFocused: boolean) => void) => Promise<() => void>
}

const selectedLineKey = (spaceId: string | null, botId: string | null) =>
	spaceId === null || botId === null ? null : rosterLineKey({ spaceId, botId })

export const createBotBadgeSource = ({
	chat,
	roster,
	hasFocus,
	watchFocus,
}: BotBadgeSourceOptions): BadgeSource =>
	createBadgeSource({
		states: {
			stateFor: (key) => {
				const { spaceId, botId } = rosterLineOf(key)
				const state = chat.stateFor(botId)
				const { soloThreads } = roster.getState()
				return runsIn(soloThreads, state.conversationId, spaceId) ? state : null
			},
			subscribe: chat.subscribe,
		},
		selection: {
			getState: () => {
				const { rosters, spaceId, selectedBotId } = roster.getState()
				return {
					ids: rosterLinesIn(rosters).map(rosterLineKey),
					selectedId: selectedLineKey(spaceId, selectedBotId),
				}
			},
			subscribe: roster.subscribe,
		},
		ruleOf: badgeAfter,
		hasFocus,
		watchFocus,
	})
