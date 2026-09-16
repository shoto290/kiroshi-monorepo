import { describe, expect, it } from "vitest"

import {
	answeredRow,
	askingRow,
	type PostedQuestion,
	type PostedRequest,
	withPostedRows,
} from "./posted-question"
import { questionMessageIdOf } from "./question-message"

import type {
	TranscriptDraft,
	TranscriptMessage,
} from "../conversations/transcript-contract"

const CONVERSATION = "conversation-1"

const requestOf = (id: string): PostedRequest => ({
	id,
	isPosted: true,
	questions: [
		{
			header: "Sign in",
			question: "How do you want to sign in?",
			multiSelect: false,
			options: [{ label: "Subscription", description: null, preview: null }],
		},
	],
})

const askingOf = (id: string): TranscriptDraft =>
	askingRow({
		request: requestOf(id),
		conversationId: CONVERSATION,
		authorBotId: "bot-1",
		createdAt: 10,
	})

const armedOf = (id: string): PostedQuestion => ({
	request: requestOf(id),
	onAnswers: () => Promise.resolve(),
	conversationId: CONVERSATION,
	asking: askingOf(id),
	answered: null,
	answeredAfterSeq: null,
	isAnswering: false,
	isAnswered: false,
})

const answerOf = (id: string, content: string): TranscriptDraft =>
	answeredRow({
		id: `answer-${id}`,
		asking: askingOf(id),
		content,
		createdAt: 20,
	})

const answeredOf = (
	id: string,
	answeredAfterSeq: number,
	answered: TranscriptDraft | null = answerOf(id, "Subscription"),
): PostedQuestion => ({
	...armedOf(id),
	answered,
	answeredAfterSeq,
	isAnswered: true,
})

const storedOf = (seq: number, content: string): TranscriptMessage => ({
	id: `message-${seq}`,
	conversationId: CONVERSATION,
	turnId: `turn-${seq}`,
	seq,
	role: "user",
	content,
	completion: "complete",
	createdAt: seq,
	authorBotId: null,
	repliedToMessageId: null,
	runtimeSessionId: null,
})

describe("withPostedRows", () => {
	const contentsOf = (rows: TranscriptMessage[]) =>
		rows.map(({ content }) => content)

	const isAscending = (rows: TranscriptMessage[]) =>
		rows.every(
			(row, index) => index === 0 || row.seq > (rows[index - 1]?.seq ?? 0),
		)

	it("leaves the messages untouched when nothing is posted", () => {
		const messages = [storedOf(1, "one")]

		expect(withPostedRows(messages, [])).toBe(messages)
	})

	it("places an armed asking below every loaded message", () => {
		const messages = [storedOf(1, "one"), storedOf(2, "two")]

		const rows = withPostedRows(messages, [armedOf("posted-1")])

		expect(contentsOf(rows).at(-1)).toContain("How do you want to sign in?")
		expect(isAscending(rows)).toBe(true)
	})

	it("keeps an armed asking below messages that load in afterwards", () => {
		const posted = [armedOf("posted-1")]
		const seqOfAsking = (messages: TranscriptMessage[]) =>
			withPostedRows(messages, posted).at(-1)?.seq ?? 0

		expect(seqOfAsking([])).toBeLessThan(1)
		expect(
			seqOfAsking([storedOf(1, "one"), storedOf(2, "two")]),
		).toBeGreaterThan(2)
	})

	it("holds an answered question and its answer above what is stored afterwards", () => {
		const rows = withPostedRows(
			[storedOf(1, "one"), storedOf(2, "two")],
			[answeredOf("posted-1", 1)],
		)

		expect(contentsOf(rows)).toEqual([
			"one",
			expect.stringContaining("How do you want to sign in?"),
			"Subscription",
			"two",
		])
		expect(isAscending(rows)).toBe(true)
	})

	it("holds an answered question with no answer row at the same place", () => {
		const rows = withPostedRows(
			[storedOf(1, "one"), storedOf(2, "two")],
			[answeredOf("posted-1", 1, null)],
		)

		expect(contentsOf(rows)).toEqual([
			"one",
			expect.stringContaining("How do you want to sign in?"),
			"two",
		])
		expect(isAscending(rows)).toBe(true)
	})

	it("keeps several questions of one conversation in the order they were posted", () => {
		const rows = withPostedRows(
			[storedOf(1, "one")],
			[
				answeredOf("posted-1", 1, answerOf("posted-1", "first")),
				answeredOf("posted-2", 1, answerOf("posted-2", "second")),
				armedOf("posted-3"),
			],
		)

		expect(rows.map(({ id }) => id)).toEqual([
			"message-1",
			questionMessageIdOf("posted-1"),
			"answer-posted-1",
			questionMessageIdOf("posted-2"),
			"answer-posted-2",
			questionMessageIdOf("posted-3"),
		])
		expect(isAscending(rows)).toBe(true)
	})
})
