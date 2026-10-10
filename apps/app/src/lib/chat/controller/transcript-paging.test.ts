import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	REPLY,
	seeded,
	spoken,
} from "./controller-fixtures"

import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import { TRANSCRIPT_PAGE_SIZE } from "../../conversations/transcript-contract"
import { botIdentity } from "../../conversations/transcript-fixtures"

const HISTORY = 250

describe("history above the transcript", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("walks back through a history far longer than one page, once each", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(HISTORY) })
		const { controller } = await bootedHarness({ store })

		const tail = controller.getState()
		expect(tail.messages).toHaveLength(20)
		expect(tail.messages.at(-1)?.id).toBe(`stored-${HISTORY}`)
		expect(tail.hasOlder).toBe(true)

		let pages = 0
		while (controller.getState().hasOlder && pages < HISTORY) {
			pages += 1
			await controller.loadOlder()
		}

		const state = controller.getState()
		const ids = state.messages.map((message) => message.id)
		expect(state.hasOlder).toBe(false)
		expect(state.loadingOlder).toBe(false)
		expect(ids).toHaveLength(HISTORY)
		expect(new Set(ids).size).toBe(HISTORY)
		expect(state.messages.map((message) => message.seq)).toEqual(
			Array.from({ length: HISTORY }, (_, index) => index + 1),
		)
		expect(ids[0]).toBe("stored-1")
	})

	it("pages back into the store when the reader comes back", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(HISTORY) })
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store })
		await harness.controller.loadOlder()
		await harness.controller.loadOlder()
		await harness.controller.loadOlder()
		harness.controller.leave(BOT)

		await harness.controller.open(other.id, null)
		await vi.runAllTimersAsync()
		await harness.controller.open(BOT, null)
		await vi.runAllTimersAsync()
		await harness.controller.loadOlder()

		const state = harness.controller.getState()
		expect(state.messages).toHaveLength(TRANSCRIPT_PAGE_SIZE * 2)
		expect(state.messages.at(-1)?.id).toBe(`stored-${HISTORY}`)
		expect(new Set(state.messages.map((message) => message.id)).size).toBe(
			state.messages.length,
		)
		harness.detach()
	})

	it("drops the pages loaded above the window when the screen leaves", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(HISTORY) })
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const harness = await bootedHarness({ store, botId: other.id })
		await harness.controller.send("hello")
		await vi.runAllTimersAsync()
		const held = harness.controller.stateFor(other.id).messages
		await harness.controller.open(BOT, null)
		await vi.runAllTimersAsync()
		await harness.controller.loadOlder()
		await harness.controller.loadOlder()
		await harness.controller.loadOlder()

		harness.controller.leave(BOT)

		const left = harness.controller.stateFor(BOT)
		expect(left.messages).toHaveLength(TRANSCRIPT_PAGE_SIZE)
		expect(left.messages.at(-1)?.id).toBe(`stored-${HISTORY}`)
		expect(left.hasOlder).toBe(true)
		expect(harness.controller.stateFor(other.id).messages).toBe(held)
		harness.detach()
	})

	it("asks for nothing more once the beginning has been reached", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(4) })
		let reads = 0
		const { controller } = await bootedHarness({
			store: {
				...store,
				loadPage: (conversationId, cursor) => {
					reads += 1
					return store.loadPage(conversationId, cursor)
				},
			},
		})
		expect(reads).toBe(1)

		await controller.loadOlder()
		await controller.loadOlder()

		expect(reads).toBe(1)
		expect(controller.getState().messages).toHaveLength(4)
	})

	it("keeps a prompt sent after paging at the end of the transcript", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(HISTORY) })
		const { controller } = await bootedHarness({ store })
		await controller.loadOlder()

		await controller.send("and then?")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.messages).toHaveLength(42)
		expect(spoken(state.messages).slice(-2)).toEqual([
			["user", "and then?", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(
			state.messages.every(
				(message, index) =>
					index === 0 || message.seq > state.messages[index - 1].seq,
			),
		).toBe(true)
	})
})

describe("history above the transcript", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("reads one page at a time, however often it is asked", async () => {
		const store = createFakeTranscriptStore({ messages: seeded(HISTORY) })
		let inFlight = 0
		let overlapped = false
		const { controller } = await bootedHarness({
			store: {
				...store,
				loadPage: async (conversationId, cursor) => {
					inFlight += 1
					overlapped ||= inFlight > 1
					const page = await store.loadPage(conversationId, cursor)
					inFlight -= 1
					return page
				},
			},
		})

		await Promise.all([
			controller.loadOlder(),
			controller.loadOlder(),
			controller.loadOlder(),
		])

		expect(overlapped).toBe(false)
		expect(controller.getState().messages).toHaveLength(40)
	})
})
