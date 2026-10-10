import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BOT, bootedHarness, reload } from "./controller-fixtures"

import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("sends the prompt through the host, summoning its companion, and writes no turn", async () => {
		const { controller, store } = await bootedHarness()
		const sent = vi.spyOn(store, "sendUserMessage")
		const started = vi.spyOn(store, "startTurn")
		const completed = vi.spyOn(store, "completeTurn")

		await controller.send("hello")
		await vi.runAllTimersAsync()

		expect(sent).toHaveBeenCalledTimes(1)
		expect(sent).toHaveBeenCalledWith(
			expect.objectContaining({ content: "hello", authorBotId: null }),
			[BOT],
		)
		expect(started).not.toHaveBeenCalled()
		expect(completed).not.toHaveBeenCalled()
	})

	it("writes the prompt down before it submits it", async () => {
		const order: string[] = []
		const store = createFakeTranscriptStore()
		const { controller } = await bootedHarness({
			store: {
				...store,
				sendUserMessage: (message, summoned) => {
					order.push("stored")
					return store.sendUserMessage(message, summoned)
				},
			},
			driver: (fake) => ({
				...fake,
				submitPrompt: (scope, text) => {
					order.push("submitted")
					return fake.submitPrompt(scope, text)
				},
			}),
		})

		await controller.send("hello")

		expect(order).toEqual(["stored", "submitted"])
	})

	it("never submits a prompt the store refused to send", async () => {
		const store = createFakeTranscriptStore()
		const refusal = {
			kind: "storage",
			failure: { kind: "poisonedConnection" },
		}
		const { controller, driver } = await bootedHarness({
			store: { ...store, sendUserMessage: () => Promise.reject(refusal) },
		})
		const submitSpy = vi.spyOn(driver, "submitPrompt")

		await controller.send("hello")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(submitSpy).not.toHaveBeenCalled()
		expect(state.messages).toEqual([])
		expect(state.turn).toBe("failed")
		expect(state.errors.at(-1)?.error).toEqual({
			kind: "writeFailed",
			detail: "the transcript store refused it (storage, poisonedConnection)",
		})
		expect(await reload(store)).toEqual([])
	})
})
