import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	createHarness,
	reload,
	seeded,
	spoken,
} from "./controller-fixtures"

import { isSessionReady } from "../chat-state"
import {
	createFakeTranscriptStore,
	FAKE_CHAT_ID,
} from "../../conversations/fake-transcript-store"
import { message as storedMessage } from "../../conversations/transcript-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("reads a reply left mid-stream by a dead host back as interrupted", async () => {
		const store = createFakeTranscriptStore({
			messages: [
				storedMessage({
					id: "m-1",
					conversationId: FAKE_CHAT_ID,
					seq: 1,
					role: "user",
					content: "hello",
				}),
				storedMessage({
					id: "m-2",
					conversationId: FAKE_CHAT_ID,
					seq: 2,
					content: "Half an ans",
					completion: "streaming",
				}),
			],
		})

		expect(spoken(await reload(store))).toEqual([
			["user", "hello", "complete"],
			["assistant", "Half an ans", "interrupted"],
		])
	})

	it("boots on the stored transcript without resuming anything", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(4) })
		const { driver, controller } = createHarness({ store })
		const startSpy = vi.spyOn(driver, "startOrResumeSession")

		await controller.open(BOT, null)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(startSpy).toHaveBeenCalledWith(state.runtime, undefined)
		expect(state.conversationId).toBe(FAKE_CHAT_ID)
		expect(state.messages.map((message) => message.id)).toEqual([
			"stored-1",
			"stored-2",
			"stored-3",
			"stored-4",
		])
		expect(state.hasOlder).toBe(false)
		expect(isSessionReady(state)).toBe(true)
	})

	it("still opens a session when the stored transcript cannot be read", async () => {
		const store = createFakeTranscriptStore()
		const { controller } = createHarness({
			store: { ...store, loadPage: () => Promise.reject({ kind: "storage" }) },
		})

		await controller.open(BOT, null)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.messages).toEqual([])
		expect(state.errors.at(-1)?.error.kind).toBe("writeFailed")
		expect(isSessionReady(state)).toBe(true)
	})
})
