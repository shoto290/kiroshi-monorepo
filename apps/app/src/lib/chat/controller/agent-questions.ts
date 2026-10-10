import {
	type BotChat,
	isRunOutsideOpenThread,
	isUnwritten,
	pendingPostOf,
} from "./bot-chat"
import type { ChatContext } from "./chat-context"
import type { PostedAnswers } from "./posted-answers"
import type { TranscriptPaging } from "./transcript-paging"

import { answeredText, questionMessageIdOf } from "../question-message"
import type {
	PermissionDecision,
	QuestionAnswers,
	QuestionRequest,
	RuntimeScope,
} from "../../agent/contract"
import type { NewUserMessage } from "../../conversations/store-contract"

type AgentQuestionsParts = {
	loadLatest: TranscriptPaging["loadLatest"]
	answerPosted: PostedAnswers["answerPosted"]
}

export type AgentQuestions = ReturnType<typeof createAgentQuestions>

export const createAgentQuestions = (
	{
		driver,
		store,
		transcript,
		foreignTurns,
		newId,
		now,
		senderAccountId,
		report,
		write,
		botsShowing,
		showForeignTurn,
	}: ChatContext,
	{ loadLatest, answerPosted }: AgentQuestionsParts,
) => {
	const answerForeign = async (
		bot: BotChat,
		scope: RuntimeScope,
		id: string,
		send: () => Promise<void>,
	) => {
		try {
			await send()
			foreignTurns.release(scope, id)
			botsShowing(scope.conversationId).forEach(showForeignTurn)
		} catch (reason) {
			report(bot, reason)
		}
	}

	const respond = async (
		bot: BotChat,
		id: string,
		decision: PermissionDecision,
	) => {
		const foreign = foreignTurns.scopeAsking(id)
		if (foreign) {
			await answerForeign(bot, foreign, id, () =>
				driver.respondToPermission(foreign, id, decision),
			)
			return
		}
		const runtime = bot.state.runtime
		if (!runtime) {
			return
		}
		await driver
			.respondToPermission(runtime, id, decision)
			.catch((reason) => report(bot, reason))
	}

	const issuedAskingOf = (bot: BotChat, request: QuestionRequest) => {
		const id = questionMessageIdOf(request.id)
		return isUnwritten(bot, id) ? null : id
	}

	const showAnswerInOpenThread = (bot: BotChat, answered: NewUserMessage) => {
		if (bot.state.conversationId !== answered.conversationId) {
			return
		}
		transcript.append({
			...answered,
			role: "user",
			completion: "complete",
			authorAccountId: senderAccountId(),
			authorName: null,
			runtimeSessionId: null,
		})
	}

	const recordAnswers = (
		bot: BotChat,
		request: QuestionRequest,
		answers: QuestionAnswers,
	) => {
		const turn = bot.activeTurn
		const content = answeredText(request, answers)
		if (!turn || content.length === 0) {
			return
		}
		const answered: NewUserMessage = {
			id: newId(),
			conversationId: turn.conversationId,
			turnId: turn.id,
			authorBotId: null,
			repliedToMessageId: issuedAskingOf(bot, request),
			content,
			createdAt: now(),
		}
		write(
			bot,
			() => store.appendUserMessage(answered),
			() => showAnswerInOpenThread(bot, answered),
		)
	}

	const answer = async (bot: BotChat, id: string, answers: QuestionAnswers) => {
		const foreign = foreignTurns.scopeAsking(id)
		if (foreign) {
			await answerForeign(bot, foreign, id, () =>
				driver.answerQuestion(foreign, id, answers),
			)
			return
		}
		const posted = pendingPostOf(bot, id)
		if (posted) {
			await answerPosted(bot, posted, answers)
			return
		}
		const runtime = bot.state.runtime
		const request = bot.state.question
		if (!runtime || request?.id !== id || isRunOutsideOpenThread(bot)) {
			return
		}
		const conversationId = bot.state.conversationId
		const isAnswerable =
			(await loadLatest(bot)) && bot.state.conversationId === conversationId
		if (!isAnswerable) {
			return
		}
		try {
			await driver.answerQuestion(runtime, id, answers)
			recordAnswers(bot, request, answers)
		} catch (reason) {
			report(bot, reason)
		}
	}

	return { respond, answer }
}
