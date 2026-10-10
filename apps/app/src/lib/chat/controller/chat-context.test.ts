import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	ANNOUNCED,
	BOT,
	bootedHarness,
	REPLY,
	runOf,
	STEP_MS,
	STREAMING_MESSAGE,
	spoken,
} from "./controller-fixtures"

import type { ChatController } from "../chat-controller"
import type { AgentEvent } from "../../agent/contract"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import { botIdentity } from "../../conversations/transcript-fixtures"
import { lastWordIn } from "../../conversations/transcript-state"

const previewFor = (controller: ChatController, botId: string) =>
	lastWordIn(controller.stateFor(botId).messages)

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("keeps a companion streaming into its own conversation after the reader switches", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		vi.spyOn(harness.driver, "submitPrompt").mockResolvedValue()
		await harness.controller.send("hello")
		harness.driver.pushEvent({ type: "turnChanged", state: "running" })
		harness.driver.pushEvent({
			type: "messageStarted",
			message: STREAMING_MESSAGE,
		})
		harness.driver.pushEvent({
			type: "messageDelta",
			id: "msg-1",
			seq: 1,
			text: "Half",
		})
		await vi.runAllTimersAsync()
		const leaving = runOf(harness.controller)

		await harness.controller.open(other.id, null)
		await vi.runAllTimersAsync()
		for (const event of [
			{ type: "messageDelta", id: "msg-1", seq: 2, text: " an answer" },
			{
				type: "messageCompleted",
				message: {
					...STREAMING_MESSAGE,
					text: "Half an answer",
					completion: "complete",
				},
			},
			{
				type: "turnEnded",
				ended: { sessionId: ANNOUNCED, outcome: "completed" },
			},
		] satisfies AgentEvent[]) {
			harness.driver.pushEvent(event, leaving)
		}
		await vi.runAllTimersAsync()

		expect(harness.controller.getState().messages).toEqual([])
		const left = await store.loadPage((await store.mainChat(BOT)).id, null)
		expect(
			left.messages.map((row) => [row.role, row.content, row.completion]),
		).toEqual([
			["user", "hello", "complete"],
			["assistant", "Half an answer", "complete"],
		])

		await harness.controller.open(BOT, null)
		await vi.runAllTimersAsync()
		expect(spoken(harness.controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "Half an answer", "complete"],
		])
		expect(runOf(harness.controller)).toEqual(leaving)
		harness.detach()
	})

	it("holds the last word of a companion answering in the background", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		await harness.controller.send("hello")
		await vi.advanceTimersByTimeAsync(STEP_MS * 4)

		await harness.controller.open(other.id, null)

		expect(previewFor(harness.controller, BOT)).toMatchObject({
			text: "hello",
		})
		expect(previewFor(harness.controller, other.id)).toBeUndefined()

		await vi.runAllTimersAsync()
		expect(previewFor(harness.controller, BOT)).toMatchObject({ text: REPLY })
		harness.detach()
	})
})
