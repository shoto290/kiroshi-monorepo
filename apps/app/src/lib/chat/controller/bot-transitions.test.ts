import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	runOf,
	STEP_MS,
	spoken,
} from "./controller-fixtures"

import { isSessionReady } from "../chat-state"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import { botIdentity } from "../../conversations/transcript-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("switches the visible conversation and the run to the companion it is opened on", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		await harness.controller.send("hello")
		await vi.runAllTimersAsync()
		const before = spoken(harness.controller.getState().messages)
		expect(before.length).toBe(2)

		await harness.controller.open(other.id, null)
		await vi.runAllTimersAsync()

		const switched = harness.controller.getState()
		expect(switched.conversationId).toBe((await store.mainChat(other.id)).id)
		expect(switched.messages).toEqual([])
		expect(runOf(harness.controller).botId).toBe(other.id)

		await harness.controller.open(BOT, null)
		await vi.runAllTimersAsync()
		expect(spoken(harness.controller.getState().messages)).toEqual(before)
		expect(runOf(harness.controller).botId).toBe(BOT)
		harness.detach()
	})

	it("opens no second process for a companion that already holds one", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		const held = runOf(harness.controller)
		const startSpy = vi.spyOn(harness.driver, "startOrResumeSession")

		expect(await harness.controller.open(BOT, null)).toBeNull()
		await harness.controller.open(other.id, null)
		await harness.controller.open(BOT, null)
		await vi.runAllTimersAsync()

		expect(startSpy).toHaveBeenCalledTimes(1)
		expect(startSpy).toHaveBeenCalledWith(
			expect.objectContaining({ botId: other.id }),
			undefined,
		)
		expect(runOf(harness.controller)).toEqual(held)
		harness.detach()
	})

	it("changes the session once when a move closes and two callers reopen", async () => {
		const harness = await bootedHarness()
		const startSpy = vi.spyOn(harness.driver, "startOrResumeSession")
		const shutdownSpy = vi.spyOn(harness.driver, "shutdown")

		let endShutdown = () => {}
		shutdownSpy.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					endShutdown = resolve
				}),
		)

		const closing = harness.controller.close(BOT)
		const followed = harness.controller.open(BOT, null)
		const moved = harness.controller.open(BOT, null)
		await vi.advanceTimersByTimeAsync(STEP_MS)
		expect(startSpy).not.toHaveBeenCalled()

		endShutdown()
		await Promise.all([closing, followed, moved])
		await vi.runAllTimersAsync()

		expect(shutdownSpy).toHaveBeenCalledTimes(1)
		expect(startSpy).toHaveBeenCalledTimes(1)
		expect(harness.controller.getState().errors).toEqual([])
		expect(isSessionReady(harness.controller.getState())).toBe(true)
		harness.detach()
	})

	it("keeps the companion the reader picked while a queued session change lands", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		let endShutdown = () => {}
		vi.spyOn(harness.driver, "shutdown").mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					endShutdown = resolve
				}),
		)

		const closing = harness.controller.close(BOT)
		const queued = harness.controller.open(BOT, null)
		const picked = harness.controller.open(other.id, null)
		expect(harness.controller.getState().runtime).toBeNull()

		await vi.advanceTimersByTimeAsync(STEP_MS)
		endShutdown()
		await vi.runAllTimersAsync()
		await Promise.all([closing, queued, picked])

		expect(harness.controller.getState().runtime?.botId).toBe(other.id)
		expect(harness.controller.stateFor(BOT).sessionOpen).toBe(true)
		harness.detach()
	})

	it("ends the runtime of a companion that is deleted while it streams", async () => {
		const harness = await bootedHarness()
		const shutdownSpy = vi.spyOn(harness.driver, "shutdown")
		await harness.controller.send("hello")
		await vi.advanceTimersByTimeAsync(STEP_MS * 4)
		const running = runOf(harness.controller)

		await harness.controller.close(BOT)

		expect(shutdownSpy).toHaveBeenCalledWith(running)
		expect(harness.controller.getState().conversationId).toBeNull()
		await expect(
			harness.driver.submitPrompt(running, "anybody there?"),
		).rejects.toEqual({ kind: "notStarted" })
		harness.detach()
	})
})
