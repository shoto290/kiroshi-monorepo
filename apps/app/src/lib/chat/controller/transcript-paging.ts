import type { BotChat } from "./bot-chat"
import type { ChatContext } from "./chat-context"

import type { TranscriptMessage } from "../../conversations/transcript-contract"

export const NO_LANDED_MESSAGES: TranscriptMessage[] = []

export type TranscriptPaging = ReturnType<typeof createTranscriptPaging>

export const createTranscriptPaging = ({
	transcript,
	enqueue,
	dispatch,
	reportRead,
}: ChatContext) => {
	const follow = (bot: BotChat, isAtLiveEdge: boolean) => {
		const conversationId = bot.state.conversationId
		if (conversationId) {
			transcript.follow(conversationId, isAtLiveEdge)
		}
	}

	const loadOlder = async (bot: BotChat) => {
		const conversationId = bot.state.conversationId
		if (!conversationId || !bot.state.hasOlder || bot.state.loadingOlder) {
			return
		}
		dispatch(bot, { type: "olderLoading", loading: true })
		try {
			await enqueue(() => transcript.loadOlder(conversationId))
		} catch (reason) {
			reportRead(bot, reason)
		} finally {
			dispatch(bot, { type: "olderLoading", loading: false })
		}
	}

	const loadNewer = async (bot: BotChat) => {
		const conversationId = bot.state.conversationId
		if (!conversationId || !bot.state.hasNewer || bot.state.loadingNewer) {
			return
		}
		dispatch(bot, { type: "newerLoading", loading: true })
		try {
			await enqueue(() => transcript.loadNewer(conversationId))
		} catch (reason) {
			reportRead(bot, reason)
		} finally {
			dispatch(bot, { type: "newerLoading", loading: false })
		}
	}

	const loadLatest = async (bot: BotChat) => {
		const conversationId = bot.state.conversationId
		if (!conversationId || !bot.state.hasNewer) {
			return true
		}
		try {
			await enqueue(() => transcript.loadLatest(conversationId))
			return true
		} catch (reason) {
			reportRead(bot, reason)
			return false
		}
	}

	const landOn = (bot: BotChat, seq: number) => {
		const conversationId = bot.state.conversationId
		if (!conversationId) {
			return Promise.resolve(NO_LANDED_MESSAGES)
		}
		return enqueue(transcript.askLanding(conversationId, seq))
	}

	return { follow, loadOlder, loadNewer, loadLatest, landOn }
}
