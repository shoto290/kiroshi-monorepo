import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	answerQuestion,
	askingIn,
	askingsIn,
	BOT,
	bootedHarness,
	isAscending,
	isPosted,
	POSTED,
	POSTED_ANSWER,
	reload,
	sessionlessHarness,
	spoken,
} from "./controller-fixtures"

import type { ChatController } from "../chat-controller"
import type { PostedAnswerHandler, PostedRequest } from "../posted-question"
import { questionMessageIdOf } from "../question-message"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"

const MASKED_KEY = "sk-ant-kept-out"

const MASKED: PostedRequest = {
	id: "posted-masked",
	isPosted: true,
	questions: [
		{
			header: "API key",
			question: "Paste your key",
			multiSelect: false,
			options: [],
			entry: { label: "Key", isSecret: true },
		},
	],
}

const answeredIn = (controller: ChatController) =>
	controller
		.getState()
		.messages.find(
			(message) =>
				message.repliedToMessageId === questionMessageIdOf(POSTED.id),
		)

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("a question posted without a session", () => {
		beforeEach(() => {
			answerQuestion.mockClear()
		})

		it("runs the handler when the reader picks an option", async () => {
			const { controller } = await sessionlessHarness()
			const onAnswers = vi.fn(() => Promise.resolve())
			controller.postQuestion(BOT, POSTED, onAnswers)
			await vi.runAllTimersAsync()

			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			expect(onAnswers).toHaveBeenCalledWith(POSTED_ANSWER)
			expect(answerQuestion).not.toHaveBeenCalled()
			expect(controller.getState().question).toBeNull()
			const answered = answeredIn(controller)
			expect(answered?.role).toBe("user")
			expect(answered?.content).toBe("Subscription")
			expect(controller.getState().errors).toEqual([])
		})

		it("leaves nothing of the asking or its answer in the store", async () => {
			const store = createFakeTranscriptStore()
			const { controller, detach } = await sessionlessHarness(store)
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()
			detach()

			expect(await reload(store)).toEqual([])
		})

		it("keeps an answered question and its answer when it is withdrawn", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			controller.withdrawQuestion(BOT, POSTED.id)
			await vi.runAllTimersAsync()

			expect(askingIn(controller)).toBeDefined()
			expect(answeredIn(controller)?.content).toBe("Subscription")
		})

		it("holds the asking and its answer above what is stored afterwards", async () => {
			const { controller, store } = await bootedHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			await controller.send("hello")
			await vi.runAllTimersAsync()

			const { messages } = controller.getState()
			const positions = messages.map((message) => message.content)
			expect(positions.indexOf("Subscription")).toBe(
				positions.findIndex((content) =>
					content.includes("How do you want to sign in?"),
				) + 1,
			)
			expect(positions.indexOf("Subscription")).toBeLessThan(
				positions.indexOf("hello"),
			)
			expect(isAscending(messages)).toBe(true)
			expect(spoken(await reload(store))).toEqual(
				spoken(messages.filter((message) => !isPosted(message))),
			)
		})

		it("runs the handler and asks nothing more for an answer with no text", async () => {
			const { controller } = await sessionlessHarness()
			const onAnswers = vi.fn(() => Promise.resolve())
			controller.postQuestion(BOT, POSTED, onAnswers)
			await vi.runAllTimersAsync()

			await controller.answer(POSTED.id, {})
			await vi.runAllTimersAsync()

			expect(onAnswers).toHaveBeenCalledWith({})
			expect(controller.getState().question).toBeNull()
			expect(answeredIn(controller)).toBeUndefined()
			expect(askingsIn(controller)).toHaveLength(1)
		})

		it("never brings back or withdraws a question answered with no text", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, MASKED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			await controller.answer(MASKED.id, { "Paste your key": MASKED_KEY })
			await vi.runAllTimersAsync()
			const answered = controller.getState()

			expect(
				controller.postQuestion(BOT, MASKED, () => Promise.resolve()),
			).toBe(false)
			controller.withdrawQuestion(BOT, MASKED.id)
			await vi.runAllTimersAsync()

			expect(controller.getState()).toBe(answered)
			expect(answered.question).toBeNull()
			expect(
				answered.messages.filter(
					(message) => message.id === questionMessageIdOf(MASKED.id),
				),
			).toHaveLength(1)
		})

		it("keeps what the reader typed into a masked entry out of the transcript", async () => {
			const { controller } = await sessionlessHarness()
			const onAnswers = vi.fn(() => Promise.resolve())
			controller.postQuestion(BOT, MASKED, onAnswers)
			await vi.runAllTimersAsync()

			await controller.answer(MASKED.id, { "Paste your key": MASKED_KEY })
			await vi.runAllTimersAsync()

			const { messages, question } = controller.getState()
			expect(onAnswers).toHaveBeenCalledWith({ "Paste your key": MASKED_KEY })
			expect(question).toBeNull()
			expect(
				messages.some((message) => message.content.includes(MASKED_KEY)),
			).toBe(false)
		})
	})
})

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("a question posted without a session", () => {
		beforeEach(() => {
			answerQuestion.mockClear()
		})

		it("keeps the question answerable and names the rejection when the handler rejects", async () => {
			const { controller } = await sessionlessHarness()
			const onAnswers = vi
				.fn<PostedAnswerHandler>()
				.mockRejectedValueOnce({
					kind: "storage",
					failure: { kind: "poisonedConnection" },
				})
				.mockResolvedValueOnce(undefined)
			controller.postQuestion(BOT, POSTED, onAnswers)
			await vi.runAllTimersAsync()

			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			const refused = controller.getState()
			expect(refused.question?.id).toBe(POSTED.id)
			expect(answeredIn(controller)).toBeUndefined()
			expect(refused.errors.map(({ error }) => error)).toEqual([
				{ kind: "unknownFailure", detail: "storage, poisonedConnection" },
			])

			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			expect(controller.getState().question).toBeNull()
			expect(answeredIn(controller)?.content).toBe("Subscription")
		})

		it("withdraws the question only once the handler has resolved", async () => {
			const { controller } = await sessionlessHarness()
			let resolveAnswers = () => {}
			controller.postQuestion(
				BOT,
				POSTED,
				() =>
					new Promise<void>((resolve) => {
						resolveAnswers = resolve
					}),
			)
			await vi.runAllTimersAsync()

			const answering = controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			expect(controller.getState().question?.id).toBe(POSTED.id)
			expect(answeredIn(controller)).toBeUndefined()

			resolveAnswers()
			await answering
			await vi.runAllTimersAsync()

			expect(controller.getState().question).toBeNull()
			expect(answeredIn(controller)?.content).toBe("Subscription")
		})
	})
})
