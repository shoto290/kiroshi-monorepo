import type { BotChat } from "./bot-chat"
import type { ChatContext } from "./chat-context"

import {
	askingRow,
	type PostedAnswerHandler,
	type PostedQuestion,
	type PostedRequest,
} from "../posted-question"

export const createPostedQuestions = ({
	now,
	dispatch,
	syncBot,
}: ChatContext) => {
	const rearmPosted = (bot: BotChat, posted: PostedQuestion) => {
		const live = bot.state.question
		if (live) {
			return live.id === posted.request.id
		}
		dispatch(bot, { type: "questionPosted", request: posted.request })
		return true
	}

	const postQuestion = (
		bot: BotChat,
		request: PostedRequest,
		onAnswers: PostedAnswerHandler,
	) => {
		const known = bot.posted.find((posted) => posted.request.id === request.id)
		if (known) {
			return !known.isAnswered && rearmPosted(bot, known)
		}
		const conversationId = bot.state.conversationId
		if (!conversationId || bot.state.question) {
			return false
		}
		bot.posted = [
			...bot.posted,
			{
				request,
				onAnswers,
				conversationId,
				asking: askingRow({
					request,
					conversationId,
					authorBotId: bot.id,
					createdAt: now(),
				}),
				answered: null,
				answeredAfterSeq: null,
				isAnswering: false,
				isAnswered: false,
			},
		]
		dispatch(bot, { type: "questionPosted", request })
		syncBot(bot)
		return true
	}

	const withdrawQuestion = (bot: BotChat, id: string) => {
		const known = bot.posted.find((posted) => posted.request.id === id)
		if (!known || known.isAnswered) {
			return
		}
		if (!known.isAnswering) {
			bot.posted = bot.posted.filter((posted) => posted !== known)
		}
		dispatch(bot, { type: "questionWithdrawn", id })
		syncBot(bot)
	}

	return { postQuestion, withdrawQuestion }
}
