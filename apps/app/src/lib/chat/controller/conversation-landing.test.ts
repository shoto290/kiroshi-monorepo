import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	createHarness,
	deferred,
	POISONED,
	POISONED_REFUSAL,
	REPLY,
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

	it("starts once on the Space it lands on when the Space changes while a restart waits", async () => {
		const base = createFakeTranscriptStore()
		const elsewhere = await base.createSpace("Vocca")
		await base.addBotToSpace(BOT, elsewhere.id)
		const reading = deferred()
		const store: TranscriptStore = {
			...base,
			mainChat: (botId, spaceId) =>
				reading.promise.then(() => base.mainChat(botId, spaceId)),
		}
		const { driver, controller } = createHarness({ store })
		const startSpy = vi.spyOn(driver, "startOrResumeSession")
		const runSpy = vi.spyOn(store, "openRuntimeSession")

		const home = controller.open(BOT, null)
		await vi.advanceTimersByTimeAsync(0)
		const restarting = controller.restart()
		const away = controller.open(BOT, elsewhere.id)
		reading.release()
		await Promise.all([home, restarting, away])
		await vi.runAllTimersAsync()

		const landedOn = (await base.mainChat(BOT, elsewhere.id)).id
		const state = controller.getState()
		expect(state.errors).toEqual([])
		expect(state.conversationId).toBe(landedOn)
		expect(runSpy.mock.calls.map(([conversationId]) => conversationId)).toEqual(
			[landedOn],
		)
		expect(startSpy.mock.calls.map(([scope]) => scope.conversationId)).toEqual([
			landedOn,
		])
	})

	it("writes a prompt sent while the Space changes into the conversation it lands on", async () => {
		const base = createFakeTranscriptStore()
		const elsewhere = await base.createSpace("Vocca")
		await base.addBotToSpace(BOT, elsewhere.id)
		const reading = deferred()
		const store: TranscriptStore = {
			...base,
			mainChat: (botId, spaceId) =>
				spaceId === elsewhere.id
					? reading.promise.then(() => base.mainChat(botId, spaceId))
					: base.mainChat(botId, spaceId),
		}
		const { controller } = await bootedHarness({ store })

		const away = controller.open(BOT, elsewhere.id)
		await vi.advanceTimersByTimeAsync(0)
		const sending = controller.send("hello")
		reading.release()
		await Promise.all([away, sending])
		await vi.runAllTimersAsync()

		const state = controller.getState()
		const left = await base.loadPage((await base.mainChat(BOT)).id, null)
		expect(state.errors).toEqual([])
		expect(state.conversationId).toBe(
			(await base.mainChat(BOT, elsewhere.id)).id,
		)
		expect(spoken(state.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(left.messages).toEqual([])
	})

	it("lands the run the store refuses while the conversation was still opening", async () => {
		const base = createFakeTranscriptStore()
		const reading = deferred()
		const store: TranscriptStore = {
			...base,
			mainChat: (botId, spaceId) =>
				reading.promise.then(() => base.mainChat(botId, spaceId)),
			openRuntimeSession: () => Promise.reject(POISONED),
		}
		const { controller } = createHarness({ store })

		const opening = controller.open(BOT, null)
		await vi.advanceTimersByTimeAsync(0)
		const restarting = controller.restart()
		reading.release()
		await Promise.all([opening, restarting])
		await vi.runAllTimersAsync()

		expect(controller.getState().errors.map(({ error }) => error)).toEqual([
			POISONED_REFUSAL,
		])
	})

	it("starts no session for a companion closed before its conversation lands", async () => {
		const harness = createHarness()
		const runSpy = vi.spyOn(harness.store, "openRuntimeSession")
		const startSpy = vi.spyOn(harness.driver, "startOrResumeSession")

		const opening = harness.controller.open(BOT, null)
		const closing = harness.controller.close(BOT)
		await Promise.all([opening, closing])
		await vi.runAllTimersAsync()

		expect(runSpy).not.toHaveBeenCalled()
		expect(startSpy).not.toHaveBeenCalled()
		expect(harness.controller.stateFor(BOT).runtime).toBeNull()
		expect(harness.controller.stateFor(BOT).errors).toEqual([])
		harness.detach()
	})
})
