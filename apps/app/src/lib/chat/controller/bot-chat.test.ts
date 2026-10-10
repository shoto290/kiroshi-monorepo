import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	REPLY,
	STEP_MS,
	spoken,
} from "./controller-fixtures"

import { isTurnBusy } from "../chat-state"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import { botIdentity } from "../../conversations/transcript-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("lets two companions answer at once, each into its own conversation", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })

		await harness.controller.send("hello")
		await vi.advanceTimersByTimeAsync(STEP_MS * 4)
		expect(isTurnBusy(harness.controller.getState().turn)).toBe(true)

		await harness.controller.open(other.id, null)
		await harness.controller.send("salut")
		expect(isTurnBusy(harness.controller.getState().turn)).toBe(true)
		expect(harness.controller.getState().errors).toEqual([])
		await vi.runAllTimersAsync()

		const first = await store.loadPage((await store.mainChat(BOT)).id, null)
		const second = await store.loadPage(
			(await store.mainChat(other.id)).id,
			null,
		)
		expect(spoken(first.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(spoken(second.messages)).toEqual([
			["user", "salut", "complete"],
			["assistant", REPLY, "complete"],
		])
		harness.detach()
	})

	it("reports a companion answering in the background as busy", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		await harness.controller.send("hello")
		await vi.advanceTimersByTimeAsync(STEP_MS * 4)

		await harness.controller.open(other.id, null)

		expect(isTurnBusy(harness.controller.getState().turn)).toBe(false)
		expect(isTurnBusy(harness.controller.stateFor(BOT).turn)).toBe(true)
		expect(harness.controller.stateFor("nobody").turn).toBe("idle")

		await vi.runAllTimersAsync()
		expect(isTurnBusy(harness.controller.stateFor(BOT).turn)).toBe(false)
		harness.detach()
	})
})
