import type { QuotedMessage } from "@workspace/ui/components/message-quote"

import { bubbleIdOfRow, questionRunOf, recallExcerptOf } from "./question-run"
import type { ReplyTarget, TranscriptRow } from "./screen-model"
import { useBubbleVisibility } from "./use-bubble-visibility"

import type { QuestionRequest } from "../agent/contract"

export type AskedBubble = {
	messageId: string
	request: QuestionRequest
}

export type AskedQuestion = {
	asked: AskedBubble | null
	leadId?: string
	recall?: QuotedMessage
}

type AskedQuestionInput = {
	question: QuestionRequest | null
	runs: TranscriptRow[][]
	toQuote: (target: ReplyTarget) => QuotedMessage
}

const NOTHING_ASKED: AskedQuestion = { asked: null }

export function useAskedQuestion({
	question,
	runs,
	toQuote,
}: AskedQuestionInput): AskedQuestion {
	const run = question ? questionRunOf(runs, question) : null
	const anchor = run ? bubbleIdOfRow(run.card) : null
	const isInView = useBubbleVisibility(anchor)

	if (!question || !run || !anchor) {
		return NOTHING_ASKED
	}

	return {
		asked: { messageId: run.card.messageId, request: question },
		leadId: bubbleIdOfRow(run.lead),
		recall: isInView
			? undefined
			: toQuote({
					messageId: anchor,
					role: "assistant",
					excerpt: recallExcerptOf(question, run.context),
					authorBotId: run.card.authorBotId,
				}),
	}
}
