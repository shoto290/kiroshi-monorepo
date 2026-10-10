import { type BotChat, isUnwritten } from "./bot-chat"
import type { ChatContext } from "./chat-context"

import { ENDING_FOR, isWorthKeeping } from "../reply-endings"
import type { ChatMessage } from "../../agent/contract"
import type { TerminalCompletion } from "../../conversations/transcript-contract"
import { selectMessages } from "../../conversations/transcript-state"

export type ReplyWriter = ReturnType<typeof createReplyWriter>

export const createReplyWriter = ({ transcript }: ChatContext) => {
	const streamReply = (
		bot: BotChat,
		id: string,
		seq: number,
		text: string,
		conversationId: string,
	) => {
		if (text.length === 0) {
			return
		}
		if (bot.heldReply?.id === id) {
			const held = bot.heldReply
			bot.heldReply = null
			openReply(bot, held, conversationId)
		}
		const streamed = bot.openMessages.get(id)
		if (streamed === undefined || seq <= streamed) {
			return
		}
		bot.openMessages.set(id, seq)
		transcript.stream({ conversationId, id, text })
	}

	const holdReply = (bot: BotChat, message: ChatMessage) => {
		if (!bot.activeTurn || !isUnwritten(bot, message.id)) {
			return
		}
		bot.heldReply = message
	}

	const openReply = (
		bot: BotChat,
		message: ChatMessage,
		conversationId: string,
	) => {
		const turn = bot.activeTurn
		if (!turn || !isUnwritten(bot, message.id)) {
			return
		}
		bot.openMessages.set(message.id, 0)
		transcript.append({
			id: message.id,
			conversationId,
			turnId: turn.id,
			role: "assistant",
			content: "",
			completion: "streaming",
			createdAt: message.timestamp,
			authorBotId: bot.id,
			authorAccountId: null,
			authorName: null,
			repliedToMessageId: turn.promptId,
			runtimeSessionId: null,
		})
		streamReply(bot, message.id, 1, message.text, conversationId)
	}

	const settleReply = (
		bot: BotChat,
		id: string,
		completion: TerminalCompletion,
		conversationId: string,
	) => {
		if (!bot.openMessages.has(id)) {
			return
		}
		bot.openMessages.delete(id)
		bot.settledMessages.add(id)
		transcript.settle({ conversationId, id, completion })
	}

	const writeReply = (
		bot: BotChat,
		message: ChatMessage,
		completion: TerminalCompletion,
		conversationId: string,
	) => {
		openReply(bot, message, conversationId)
		settleReply(bot, message.id, completion, conversationId)
	}

	const settleHeldReply = (
		bot: BotChat,
		completion: TerminalCompletion,
		conversationId: string,
	) => {
		const held = bot.heldReply
		bot.heldReply = null
		if (held && isWorthKeeping(held, completion)) {
			writeReply(bot, held, completion, conversationId)
		}
	}

	const reviseSettled = (message: ChatMessage, conversationId: string) => {
		const shown = selectMessages(transcript.getState(), conversationId).find(
			({ id }) => id === message.id,
		)
		if (!shown || !message.text || shown.content === message.text) {
			return
		}
		transcript.revise({ conversationId, id: message.id, text: message.text })
	}

	const settleCompleted = (
		bot: BotChat,
		message: ChatMessage,
		conversationId: string,
	) => {
		const completion = ENDING_FOR[message.completion]
		if (!completion) {
			return
		}
		if (bot.settledMessages.has(message.id)) {
			return reviseSettled(message, conversationId)
		}
		if (bot.heldReply?.id === message.id) {
			bot.heldReply = null
			if (!isWorthKeeping(message, completion)) {
				return
			}
		}
		writeReply(bot, message, completion, conversationId)
	}

	const settleOpenReplies = (
		bot: BotChat,
		completion: TerminalCompletion,
		conversationId: string,
	) => {
		settleHeldReply(bot, completion, conversationId)
		for (const id of [...bot.openMessages.keys()]) {
			settleReply(bot, id, completion, conversationId)
		}
	}

	return { streamReply, holdReply, settleCompleted, settleOpenReplies }
}
