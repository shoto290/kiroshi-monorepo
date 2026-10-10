import { type BotChat, changePosted } from "./bot-chat"
import type { ChatContext } from "./chat-context"

import { toAnswerError } from "../chat-state"
import {
	answeredRow,
	type PostedQuestion,
	withoutSecretQuestions,
} from "../posted-question"
import { answeredText } from "../question-message"
import type { QuestionAnswers } from "../../agent/contract"
import { selectMessages } from "../../conversations/transcript-state"

export type PostedAnswers = ReturnType<typeof createPostedAnswers>

export const createPostedAnswers = ({
	transcript,
	newId,
	now,
	dispatch,
	announce,
	syncBot,
}: ChatContext) => {
	const answeredRowOf = (posted: PostedQuestion, answers: QuestionAnswers) => {
		const content = answeredText(
			withoutSecretQuestions(posted.request),
			answers,
		)
		return content.length === 0
			? null
			: answeredRow({
					id: newId(),
					asking: posted.asking,
					content,
					createdAt: now(),
				})
	}

	const releaseRefusedAnswer = (bot: BotChat, id: string) => {
		if (bot.state.question?.id === id) {
			changePosted(bot, id, { isAnswering: false })
			return
		}
		bot.posted = bot.posted.filter((known) => known.request.id !== id)
		syncBot(bot)
	}

	const answerPosted = async (
		bot: BotChat,
		posted: PostedQuestion,
		answers: QuestionAnswers,
	) => {
		if (posted.isAnswering) {
			return
		}
		const id = posted.request.id
		changePosted(bot, id, { isAnswering: true })
		try {
			await posted.onAnswers(answers)
		} catch (reason) {
			releaseRefusedAnswer(bot, id)
			announce(bot, { type: "failed", error: toAnswerError(reason) })
			return
		}
		changePosted(bot, id, {
			isAnswering: false,
			isAnswered: true,
			answered: answeredRowOf(posted, answers),
			answeredAfterSeq: storedSeqOf(posted.conversationId),
		})
		dispatch(bot, { type: "questionWithdrawn", id })
		syncBot(bot)
	}

	const storedSeqOf = (conversationId: string) =>
		selectMessages(transcript.getState(), conversationId).at(-1)?.seq ?? 0

	return { answerPosted }
}
