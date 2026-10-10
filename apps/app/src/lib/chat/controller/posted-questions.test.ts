import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	answerQuestion,
	askingIn,
	askingsIn,
	BOT,
	bootedHarness,
	isAscending,
	POSTED,
	POSTED_ANSWER,
	sessionlessHarness,
} from "./controller-fixtures"

import type { PostedRequest } from "../posted-question"
import { questionMessageIdOf } from "../question-message"

const OPTIONS_ONLY: PostedRequest = {
	...POSTED,
	questions: POSTED.questions.map((asked) => ({ ...asked, optionsOnly: true })),
}

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

		it("renders the asking the way the agent's own question renders", async () => {
			const { controller } = await sessionlessHarness()

			expect(
				controller.postQuestion(BOT, POSTED, () => Promise.resolve()),
			).toBe(true)
			await vi.runAllTimersAsync()

			const state = controller.getState()
			expect(state.runtime).toBeNull()
			expect(state.sessionOpen).toBe(false)
			expect(state.question?.id).toBe(POSTED.id)
			const asking = askingIn(controller)
			expect(asking?.role).toBe("assistant")
			expect(asking?.content).toContain("How do you want to sign in?")
			expect(asking?.content).toContain("Subscription")
		})

		it("prompts with what the reader typed and leaves the question armed", async () => {
			const { controller, driver } = await bootedHarness()
			const submitPrompt = vi.spyOn(driver, "submitPrompt")
			const onAnswers = vi.fn(() => Promise.resolve())
			controller.postQuestion(BOT, OPTIONS_ONLY, onAnswers)
			await vi.runAllTimersAsync()

			await controller.send("with an API key")
			await vi.runAllTimersAsync()

			expect(submitPrompt).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining("with an API key"),
				{ turnId: expect.any(String), promptId: expect.any(String) },
			)
			expect(onAnswers).not.toHaveBeenCalled()
			const state = controller.getState()
			expect(state.question?.id).toBe(OPTIONS_ONLY.id)
			expect(askingIn(controller)).toBeDefined()
			expect(
				state.messages.some((message) => message.content === "with an API key"),
			).toBe(true)
		})

		it("keeps a single asking and an unchanged state when the same question is posted twice", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			const live = controller.getState()

			expect(
				controller.postQuestion(BOT, POSTED, () => Promise.resolve()),
			).toBe(true)
			expect(controller.getState()).toBe(live)
			await vi.runAllTimersAsync()

			const asked = controller
				.getState()
				.messages.filter(
					(message) => message.id === questionMessageIdOf(POSTED.id),
				)
			expect(asked).toHaveLength(1)
		})

		it("refuses a question while another one is pending", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()

			const refused = controller.postQuestion(
				BOT,
				{ ...POSTED, id: "posted-2" },
				() => Promise.resolve(),
			)

			expect(refused).toBe(false)
			expect(controller.getState().question?.id).toBe(POSTED.id)
		})

		it("takes the asking back when the question is withdrawn", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()

			controller.withdrawQuestion(BOT, POSTED.id)
			await vi.runAllTimersAsync()

			expect(controller.getState().question).toBeNull()
			expect(askingIn(controller)).toBeUndefined()
		})

		it("holds an armed asking below what is stored while it waits", async () => {
			const { controller } = await bootedHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()

			await controller.send("hello")
			await vi.runAllTimersAsync()

			const { messages } = controller.getState()
			const positions = messages.map((message) => message.content)
			expect(
				positions.findIndex((content) =>
					content.includes("How do you want to sign in?"),
				),
			).toBeGreaterThan(positions.indexOf("hello"))
			expect(isAscending(messages)).toBe(true)
		})

		it("refuses to re-arm a held question while another request is live", async () => {
			const { controller, driver } = await bootedHarness()
			const other = { ...POSTED, id: "posted-2" }
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			driver.pushEvent({
				type: "permissionResolved",
				id: POSTED.id,
				decision: "allowOnce",
			})
			await vi.runAllTimersAsync()
			controller.postQuestion(BOT, other, () => Promise.resolve())
			await vi.runAllTimersAsync()

			expect(
				controller.postQuestion(BOT, POSTED, () => Promise.resolve()),
			).toBe(false)
			expect(controller.getState().question).toEqual(other)
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

		it("refuses a question that was already answered", async () => {
			const { controller } = await sessionlessHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			await controller.answer(POSTED.id, POSTED_ANSWER)
			await vi.runAllTimersAsync()

			const answered = controller.getState()

			expect(
				controller.postQuestion(BOT, POSTED, () => Promise.resolve()),
			).toBe(false)
			expect(controller.getState()).toBe(answered)
			expect(answered.question).toBeNull()
		})

		it("re-arms a held question whose live request was dropped", async () => {
			const { controller, driver } = await bootedHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()
			driver.pushEvent({
				type: "permissionResolved",
				id: POSTED.id,
				decision: "allowOnce",
			})
			await vi.runAllTimersAsync()
			expect(controller.getState().question).toBeNull()

			expect(
				controller.postQuestion(BOT, POSTED, () => Promise.resolve()),
			).toBe(true)
			await vi.runAllTimersAsync()

			expect(controller.getState().question).toEqual(POSTED)
			expect(askingsIn(controller)).toHaveLength(1)
		})

		it("keeps the question live when the session resets", async () => {
			const { controller } = await bootedHarness()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()

			await controller.start()
			await vi.runAllTimersAsync()

			expect(controller.getState().question).toEqual(POSTED)
			expect(askingIn(controller)).toBeDefined()
		})

		it("keeps the question live when a turn ends", async () => {
			const { controller, driver } = await bootedHarness()
			vi.spyOn(driver, "submitPrompt").mockResolvedValue()
			await controller.send("hello")
			driver.pushEvent({ type: "turnChanged", state: "running" })
			await vi.runAllTimersAsync()
			controller.postQuestion(BOT, POSTED, () => Promise.resolve())
			await vi.runAllTimersAsync()

			driver.pushEvent({
				type: "turnEnded",
				ended: { sessionId: "s-1", outcome: "completed" },
			})
			await vi.runAllTimersAsync()

			const state = controller.getState()
			expect(state.turn).toBe("idle")
			expect(state.question).toEqual(POSTED)
		})
	})
})
