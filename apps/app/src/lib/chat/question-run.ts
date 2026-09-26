import { questionMessageIdOf } from "./question-message"
import { bubbleIdOf, type TranscriptRow } from "./screen-model"

import type { QuestionRequest } from "../agent/contract"

type QuestionRun = {
	card: TranscriptRow
	lead: TranscriptRow
	context?: TranscriptRow
}

const CONTEXT_LINES = 2

const isSaid = (row: TranscriptRow) => row.text.trim().length > 0

const runHolding = (
	run: TranscriptRow[],
	cardId: string,
): QuestionRun | null => {
	const cardIndex = run.findIndex((row) => row.messageId === cardId)
	const card = run[cardIndex]
	const lead = run[0]
	if (!card || !lead) {
		return null
	}
	return {
		card,
		lead,
		context: run.slice(0, cardIndex).findLast(isSaid),
	}
}

export const questionRunOf = (
	runs: TranscriptRow[][],
	request: QuestionRequest,
): QuestionRun | null => {
	const cardId = questionMessageIdOf(request.id)
	for (const run of runs) {
		const held = runHolding(run, cardId)
		if (held) {
			return held
		}
	}
	return null
}

export const bubbleIdOfRow = (row: TranscriptRow): string =>
	bubbleIdOf(row.messageId, row.blockIndex)

const firstLinesOf = (text: string): string =>
	text.trim().split("\n").slice(0, CONTEXT_LINES).join("\n")

export const recallExcerptOf = (
	request: QuestionRequest,
	context: TranscriptRow | undefined,
): string => {
	const question = request.questions[0]?.question ?? ""
	return context ? `${firstLinesOf(context.text)}\n${question}` : question
}
