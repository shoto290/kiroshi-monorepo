import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	deferred,
	runOf,
	STREAMING_MESSAGE,
	spoken,
} from "./controller-fixtures"

import {
	createFakeTranscriptStore,
	FAKE_CHAT_ID,
} from "../../conversations/fake-transcript-store"
import type { TranscriptStore } from "../../conversations/store-port"
import { TRANSCRIPT_WINDOW_SIZE } from "../../conversations/transcript-contract"
import {
	botIdentity,
	message as storedMessage,
} from "../../conversations/transcript-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("re-reads a streaming transcript on the way back without doubling its tail", async () => {
		const base = createFakeTranscriptStore()
		const other = await base.createBot(botIdentity({ name: "Second" }))
		const stored = deferred()
		let holdsTheWrite = false
		const store: TranscriptStore = {
			...base,
			appendText: async (id, text) => {
				const written = await base.appendText(id, text)
				if (holdsTheWrite) {
					await stored.promise
				}
				return written
			},
		}
		const harness = await bootedHarness({ store })
		vi.spyOn(harness.driver, "submitPrompt").mockResolvedValue()
		await harness.controller.send("hello")
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

		holdsTheWrite = true
		harness.driver.pushEvent(
			{ type: "messageDelta", id: "msg-1", seq: 2, text: " an answer" },
			leaving,
		)
		await vi.runAllTimersAsync()

		const returning = harness.controller.open(BOT, null)
		stored.release()
		await returning
		await vi.runAllTimersAsync()

		expect(spoken(harness.controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "Half an answer", "streaming"],
		])
		harness.detach()
	})
})

describe("returning to a solo thread", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const MESSAGES = TRANSCRIPT_WINDOW_SIZE * 2

	const LANDED_SEQ = 20

	const longStore = () =>
		createFakeTranscriptStore({
			messages: Array.from({ length: MESSAGES }, (_, index) =>
				storedMessage({
					id: `m-${index + 1}`,
					seq: index + 1,
					conversationId: FAKE_CHAT_ID,
				}),
			),
		})

	it("shows the newest page again after a landed window was left", async () => {
		const { controller, detach } = await bootedHarness({ store: longStore() })

		await controller.landOn(LANDED_SEQ)
		expect(controller.getState().hasNewer).toBe(true)

		controller.leave(BOT)
		controller.enter(BOT)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.hasNewer).toBe(false)
		expect(state.messages.at(-1)?.id).toBe(`m-${MESSAGES}`)
		detach()
	})

	it("shows the landed window with no newest page spliced under it", async () => {
		const { controller, detach } = await bootedHarness({ store: longStore() })

		const landing = controller.landOn(LANDED_SEQ)
		await controller.open(BOT, null)
		await landing
		await vi.runAllTimersAsync()

		const shown = controller.getState()
		const ids = shown.messages.map((held) => held.id)
		expect(ids).toContain(`m-${LANDED_SEQ}`)
		expect(ids).not.toContain(`m-${MESSAGES}`)
		expect(shown.hasNewer).toBe(true)
		detach()
	})

	it("reads nothing back while the thread still holds messages", async () => {
		const store = longStore()
		const { controller, detach } = await bootedHarness({ store })
		const loadPage = vi.spyOn(store, "loadPage")

		controller.enter(BOT)
		await vi.runAllTimersAsync()

		expect(loadPage).not.toHaveBeenCalled()
		detach()
	})
})
