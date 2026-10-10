import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	createHarness,
	POISONED,
	POISONED_REFUSAL,
	REFUSED_REFERENCE,
	REPLY,
	referentialStore,
	reload,
	spaceElsewhere,
	spoken,
} from "./controller-fixtures"

import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import type { TranscriptStore } from "../../conversations/store-port"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("marks the prompt Claude refused without touching the row it stored", async () => {
		const store = createFakeTranscriptStore()
		let failNext = true
		const { controller } = await bootedHarness({
			store,
			replyFor: () => "one two three",
			driver: (fake) => ({
				...fake,
				submitPrompt: (scope, text) => {
					if (failNext) {
						failNext = false
						return Promise.reject({
							kind: "writeFailed",
							detail: "network down",
						})
					}
					return fake.submitPrompt(scope, text)
				},
			}),
		})

		await controller.send("hello")
		const failed = controller.getState()
		expect(failed.turn).toBe("failed")
		expect(failed.rejectedPromptId).toBe(failed.messages[0].id)
		expect(failed.messages[0].completion).toBe("complete")
		expect(failed.errors.at(-1)?.error.kind).toBe("writeFailed")

		await controller.retry(failed.messages[0].id)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.turn).toBe("idle")
		expect(state.rejectedPromptId).toBeNull()
		expect(spoken(state.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "one two three", "complete"],
		])
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
	})

	it("retries nothing but the prompt that was refused", async () => {
		const { controller } = await bootedHarness()
		await controller.send("hello")
		await vi.runAllTimersAsync()
		const settled = controller.getState()

		await controller.retry(settled.messages[0].id)

		expect(controller.getState()).toBe(settled)
	})

	it("opens a run in the open thread before retrying a prompt of it", async () => {
		let isRefusing = true
		const base = referentialStore(createFakeTranscriptStore())
		const store: TranscriptStore = {
			...base,
			boundedContext: (...context) =>
				isRefusing
					? Promise.reject(REFUSED_REFERENCE)
					: base.boundedContext(...context),
		}
		const elsewhere = await spaceElsewhere(store)
		const { controller, driver } = await bootedHarness({ store })
		await controller.send("hello")
		await vi.runAllTimersAsync()
		const rejected = controller.getState().rejectedPromptId
		isRefusing = false
		await controller.open(BOT, elsewhere)
		await controller.start()
		await controller.open(BOT, null)
		await vi.runAllTimersAsync()
		const submitSpy = vi.spyOn(driver, "submitPrompt")
		const refusals = controller.getState().errors.length

		await controller.retry(rejected ?? "")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.errors).toHaveLength(refusals)
		expect(submitSpy.mock.lastCall?.[0].conversationId).toBe(
			state.conversationId,
		)
		expect(spoken(await reload(store))).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
	})

	it("sends a plain message in a solo thread its run was left behind in", async () => {
		const store = referentialStore(createFakeTranscriptStore())
		const elsewhere = await spaceElsewhere(store)
		const { controller, driver } = await bootedHarness({ store })
		const submitSpy = vi.spyOn(driver, "submitPrompt")
		await controller.send("hello")
		await vi.runAllTimersAsync()
		await controller.open(BOT, elsewhere)
		await vi.runAllTimersAsync()
		await controller.send("over here")
		await vi.runAllTimersAsync()

		await controller.open(BOT, null)
		await vi.runAllTimersAsync()
		await controller.send("back home")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.errors).toEqual([])
		expect(submitSpy.mock.lastCall?.[0].conversationId).toBe(
			state.conversationId,
		)
		expect(spoken(await reload(store))).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
			["user", "back home", "complete"],
			["assistant", REPLY, "complete"],
		])
	})

	it("rejects a prompt sent before the session starts", async () => {
		const harness = createHarness()
		await harness.controller.open(BOT, null)
		vi.spyOn(harness.driver, "submitPrompt").mockRejectedValue({
			kind: "notStarted",
		})

		await harness.controller.send("hello")

		const state = harness.controller.getState()
		expect(state.turn).toBe("failed")
		expect(state.errors.at(-1)?.error.kind).toBe("notStarted")
		expect(spoken(state.messages)).toEqual([["user", "hello", "complete"]])
	})
})

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("says once why it holds a prompt when the store never opened the conversation", async () => {
		const store = createFakeTranscriptStore()
		const { controller, driver } = createHarness({
			store: {
				...store,
				mainChat: () => Promise.reject(POISONED),
			},
		})
		const submitSpy = vi.spyOn(driver, "submitPrompt")
		await controller.open(BOT, null)
		await vi.runAllTimersAsync()

		await controller.send("hello")

		expect(controller.getState().conversationId).toBeNull()
		expect(controller.getState().errors.map(({ error }) => error)).toEqual([
			POISONED_REFUSAL,
		])
		expect(submitSpy).not.toHaveBeenCalled()
	})
})
