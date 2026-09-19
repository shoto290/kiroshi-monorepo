import { useEffect, useState, useSyncExternalStore } from "react"

import { createConversationBadgeSource } from "./conversation-badge-source"
import type { ConversationRuntimes } from "./conversation-runtimes"
import type { SpokenWords } from "./spoken-words"

import { watchWindowFocus } from "../host"
import type { RosterController } from "../bots/roster-controller"
import type { BotBadge } from "../chat/bot-badge"

export type ConversationBadgesMount = {
	runtimes: ConversationRuntimes
	roster: RosterController
	spokenWords: SpokenWords
}

export const useConversationBadges = ({
	runtimes,
	roster,
	spokenWords,
}: ConversationBadgesMount): Record<string, BotBadge> => {
	const [source] = useState(() =>
		createConversationBadgeSource({
			runtimes,
			roster,
			spokenWords,
			hasFocus: () => document.hasFocus(),
			watchFocus: watchWindowFocus,
		}),
	)

	useEffect(() => source.start(), [source])

	return useSyncExternalStore(source.subscribe, source.getBadges)
}
