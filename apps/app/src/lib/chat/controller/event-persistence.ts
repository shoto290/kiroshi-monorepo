import { type BotChat, isUnwritten } from "./bot-chat"
import type { ChatContext } from "./chat-context"
import type { ReplyWriter } from "./reply-writer"

import { isSameCommandList } from "../chat-state"
import { questionMessageIdOf, questionMessageText } from "../question-message"
import { ENDING_FOR_OUTCOME } from "../reply-endings"
import type {
	AgentCommand,
	AgentEvent,
	QuestionRequest,
	RuntimeScope,
} from "../../agent/contract"
import type {
	TerminalCompletion,
	TranscriptDraft,
} from "../../conversations/transcript-contract"

export const createEventPersistence = (
	{ store, transcript, now, write }: ChatContext,
	{ streamReply, holdReply, settleCompleted, settleOpenReplies }: ReplyWriter,
) => {
	const writeQuestionRow = (
		bot: BotChat,
		request: QuestionRequest,
		conversationId: string,
	) => {
		const turn = bot.activeTurn
		const id = questionMessageIdOf(request.id)
		if (!turn || !isUnwritten(bot, id)) {
			return
		}
		bot.settledMessages.add(id)
		const row: TranscriptDraft = {
			id,
			conversationId,
			turnId: turn.id,
			role: "assistant",
			content: questionMessageText(request),
			completion: "complete",
			createdAt: now(),
			authorBotId: bot.id,
			authorAccountId: null,
			authorName: null,
			repliedToMessageId: turn.promptId,
			runtimeSessionId: null,
		}
		transcript.append(row)
	}

	const recordQuestion = (
		bot: BotChat,
		request: QuestionRequest,
		conversationId: string,
	) => {
		if (bot.state.question?.id !== request.id) {
			return
		}
		settleOpenReplies(bot, "complete", conversationId)
		writeQuestionRow(bot, request, conversationId)
	}

	const endTurn = (
		bot: BotChat,
		completion: TerminalCompletion,
		conversationId: string,
	) => {
		settleOpenReplies(bot, completion, conversationId)
		bot.activeTurn = null
	}

	const recordProviderSession = (
		bot: BotChat,
		scope: RuntimeScope | null,
		sessionId: string,
	) => {
		if (!scope) {
			return
		}
		write(bot, () =>
			store.recordProviderSession(
				scope.conversationId,
				scope.botId,
				scope.runtimeSessionId,
				sessionId,
			),
		)
	}

	const recordCommands = (
		bot: BotChat,
		scope: RuntimeScope | null,
		commands: AgentCommand[],
	) => {
		if (!scope) {
			return
		}
		const held = bot.commands.stored
		bot.commands.stored = commands
		bot.commands.announced = true
		if (isSameCommandList(held, commands)) {
			return
		}
		write(bot, () => store.recordBotCommands(scope.botId, commands))
	}

	const persist = (
		bot: BotChat,
		scope: RuntimeScope | null,
		event: AgentEvent,
	) => {
		const conversationId = scope?.conversationId
		if (!conversationId) {
			return
		}
		switch (event.type) {
			case "sessionReady":
				return recordProviderSession(bot, scope, event.sessionId)
			case "commandsListed":
				return recordCommands(bot, scope, event.commands)
			case "messageStarted":
				return holdReply(bot, event.message)
			case "messageDelta":
				return streamReply(bot, event.id, event.seq, event.text, conversationId)
			case "messageCompleted":
				return settleCompleted(bot, event.message, conversationId)
			case "questionRequested":
				return recordQuestion(bot, event.request, conversationId)
			case "turnEnded":
				return endTurn(
					bot,
					ENDING_FOR_OUTCOME[event.ended.outcome],
					conversationId,
				)
			default:
				return
		}
	}

	return { persist }
}
