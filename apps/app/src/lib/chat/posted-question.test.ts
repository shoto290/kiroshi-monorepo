import { describe, expect, it } from "vitest"

import {
	answeredRow,
	askingRow,
	type PostedQuestion,
	type PostedRequest,
	withPostedRows,
} from "./posted-question"

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

const postedOf = (
	id: string,
	answered: TranscriptDraft | null = null,
): PostedQuestion => ({
	request: requestOf(id),
	onAnswers: () => Promise.resolve(),
	conversationId: CONVERSATION,
	asking: askingOf(id),
	answered,
	isAnswering: false,
	isAnswered: answered !== null,
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
	it("leaves the messages untouched when nothing is posted", () => {
		const messages = [storedOf(1, "one")]

		expect(withPostedRows(messages, [])).toBe(messages)
	})

	it("never sorts a posted row above an already-loaded message", () => {
		const messages = [storedOf(1, "one"), storedOf(2, "two")]

		const rows = withPostedRows(messages, [postedOf("posted-1")])

		expect(rows.map(({ content }) => content).at(-1)).toContain(
			"How do you want to sign in?",
		)
		expect(rows.at(-1)?.seq).toBeGreaterThan(2)
	})

	it("keeps the question below messages that load in afterwards", () => {
		const posted = [postedOf("posted-1")]
		const seqOfAsking = (messages: TranscriptMessage[]) =>
			withPostedRows(messages, posted).at(-1)?.seq ?? 0

		expect(seqOfAsking([])).toBeLessThan(1)
		expect(
			seqOfAsking([storedOf(1, "one"), storedOf(2, "two")]),
		).toBeGreaterThan(2)
	})

	it("holds an answer straight under the question it replies to", () => {
		const answered = answeredRow({
			id: "answer-1",
			asking: askingOf("posted-1"),
			content: "Subscription",
			createdAt: 20,
		})

		const rows = withPostedRows(
			[storedOf(1, "one")],
			[postedOf("posted-1", answered)],
		)

		expect(rows.map(({ content }) => content)).toEqual([
			"one",
			expect.stringContaining("How do you want to sign in?"),
			"Subscription",
		])
		expect(rows.map(({ seq }) => seq > 1)).toEqual([false, true, true])
	})
})
