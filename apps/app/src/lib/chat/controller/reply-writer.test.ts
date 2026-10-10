import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	ANNOUNCED,
	bootedHarness,
	ended,
	type Harness,
	REPLY,
	ROUNDS,
	recordingStore,
	reload,
	runOf,
	STEP_MS,
	STREAMING_MESSAGE,
	spoken,
	spokenAnswer,
	toolRounds,
} from "./controller-fixtures"

import { attachmentBlock } from "../message-attachments"
import type { AgentEvent } from "../../agent/contract"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"

const ATTACHMENT_BLOCK = attachmentBlock(
	["/root/attachments/c-1/0b7c6d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e.png"],
	new Date(0),
)

const completedAs = (id: string, text: string): AgentEvent => ({
	type: "messageCompleted",
	message: { ...STREAMING_MESSAGE, id, text, completion: "complete" },
})

const saidHello = async () => {
	const harness = await bootedHarness()
	vi.spyOn(harness.driver, "submitPrompt").mockResolvedValue()
	await harness.controller.send("hello")
	return harness
}

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("stores a stopped turn as cancelled, with the words it had", async () => {
		const { controller, store } = await bootedHarness()
		await controller.send("hello")
		await vi.advanceTimersByTimeAsync(STEP_MS * 5)
		expect(controller.getState().turn).toBe("running")

		await controller.stop()
		await vi.runAllTimersAsync()

		const answer = controller.getState().messages.at(-1)
		expect(controller.getState().turn).toBe("idle")
		expect(answer?.completion).toBe("cancelled")
		expect(answer?.content.length).toBeGreaterThan(0)
		expect(answer?.content.length).toBeLessThan(REPLY.length)
		expect(spoken(await reload(store))).toEqual(
			spoken(controller.getState().messages),
		)
	})

	it("stores a failed turn as failed, with the words it had", async () => {
		const { controller, store } = await bootedHarness()

		await controller.send("explain /fail")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.turn).toBe("failed")
		expect(state.errors.at(-1)?.error.kind).toBe("crashed")
		expect(state.messages.at(-1)?.completion).toBe("failed")
		expect(state.messages.at(-1)?.content.length).toBeGreaterThan(0)
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
	})

	it("shows the attachment block a later completion adds to a settled reply", async () => {
		const { driver, controller } = await saidHello()

		for (const event of spokenAnswer("here it is")) {
			driver.pushEvent(event)
		}
		driver.pushEvent(
			completedAs("msg-answer", `here it is\n${ATTACHMENT_BLOCK}`),
		)
		driver.pushEvent(ended("completed"))
		await vi.runAllTimersAsync()

		expect(spoken(controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", `here it is\n${ATTACHMENT_BLOCK}`, "complete"],
		])
	})

	it("keeps a single reply when a later completion repeats the settled text", async () => {
		const { driver, controller } = await saidHello()
		for (const event of spokenAnswer("here it is")) {
			driver.pushEvent(event)
		}
		await vi.runAllTimersAsync()
		const settledMessages = controller.getState().messages

		driver.pushEvent(completedAs("msg-answer", "here it is"))
		await vi.runAllTimersAsync()

		expect(controller.getState().messages).toBe(settledMessages)
		expect(spoken(controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "here it is", "complete"],
		])
	})

	it("shows a reply carrying the attachment block alone", async () => {
		const { driver, controller } = await saidHello()

		driver.pushEvent({
			type: "messageStarted",
			message: { ...STREAMING_MESSAGE, id: "msg-block" },
		})
		driver.pushEvent(completedAs("msg-block", ATTACHMENT_BLOCK))
		driver.pushEvent(ended("completed"))
		await vi.runAllTimersAsync()

		expect(spoken(controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", ATTACHMENT_BLOCK, "complete"],
		])
	})

	it("keeps a replayed start, a late delta and a second ending harmless", async () => {
		const { driver, controller, store } = await bootedHarness()
		vi.spyOn(driver, "submitPrompt").mockResolvedValue()
		await controller.send("hello")

		driver.pushEvent({ type: "turnChanged", state: "running" })
		driver.pushEvent({ type: "messageStarted", message: STREAMING_MESSAGE })
		driver.pushEvent({ type: "messageDelta", id: "msg-1", seq: 1, text: "Hel" })
		driver.pushEvent({ type: "messageStarted", message: STREAMING_MESSAGE })
		driver.pushEvent({ type: "messageDelta", id: "msg-1", seq: 2, text: "lo" })
		driver.pushEvent({ type: "messageDelta", id: "msg-1", seq: 1, text: "Hel" })
		driver.pushEvent({
			type: "turnEnded",
			ended: { sessionId: "s-1", outcome: "completed" },
		})
		driver.pushEvent({
			type: "messageDelta",
			id: "msg-1",
			seq: 9,
			text: " late",
		})
		driver.pushEvent({
			type: "turnEnded",
			ended: { sessionId: "s-1", outcome: "failed" },
		})
		driver.pushEvent({
			type: "messageCompleted",
			message: { ...STREAMING_MESSAGE, text: "", completion: "cancelled" },
		})
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(spoken(state.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "Hello", "complete"],
		])
		expect(state.errors).toEqual([])
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
	})
})

describe("a turn Claude answered with tools", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const streamed = async (harness: Harness, events: AgentEvent[]) => {
		vi.spyOn(harness.driver, "submitPrompt").mockResolvedValue()
		await harness.controller.send("hello")
		harness.driver.pushEvent({ type: "turnChanged", state: "running" })
		for (const event of events) {
			harness.driver.pushEvent(event)
		}
		await vi.runAllTimersAsync()
	}

	it("stores the answer alone, and nothing for the tools before it", async () => {
		const harness = await bootedHarness()
		await streamed(harness, [
			...toolRounds(ROUNDS),
			...spokenAnswer(REPLY),
			ended("completed"),
		])

		const state = harness.controller.getState()
		expect(spoken(state.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		const stored = await reload(harness.store)
		expect(spoken(stored)).toEqual(spoken(state.messages))
		expect(stored.map((message) => message.seq)).toEqual([1, 2])
		expect(
			state.activities.filter((entry) => entry.status === "succeeded"),
		).toHaveLength(ROUNDS)
		harness.detach()
	})

	it("records the session it answered under while keeping the tools out of the transcript", async () => {
		const base = createFakeTranscriptStore()
		const { store, recorded } = recordingStore(base)
		const harness = await bootedHarness({ store })
		const run = runOf(harness.controller)

		await streamed(harness, [
			{ type: "sessionReady", sessionId: ANNOUNCED, resumed: false },
			...toolRounds(ROUNDS),
			...spokenAnswer(REPLY),
			ended("completed"),
		])

		const state = harness.controller.getState()
		expect(recorded).toEqual([[run.runtimeSessionId, ANNOUNCED]])
		expect(state.sessionId).toBe(ANNOUNCED)
		expect(state.errors).toEqual([])
		expect(
			state.activities.filter((entry) => entry.status === "succeeded"),
		).toHaveLength(ROUNDS)
		await expect(
			base.recordProviderSession(
				run.conversationId,
				run.botId,
				run.runtimeSessionId,
				"a-second-process",
			),
		).rejects.toEqual({ kind: "storage", failure: { kind: "staleWrite" } })

		const stored = await reload(harness.store)
		expect(spoken(stored)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(stored.map((message) => message.seq)).toEqual([1, 2])
		expect(
			stored.filter(
				(message) => message.role === "assistant" && message.content === "",
			),
		).toEqual([])
		harness.detach()
	})

	it("stores nothing at all for a turn that ends well without a word", async () => {
		const harness = await bootedHarness()
		await streamed(harness, [...toolRounds(3), ended("completed")])

		expect(spoken(harness.controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
		])
		expect(spoken(await reload(harness.store))).toEqual([
			["user", "hello", "complete"],
		])
		harness.detach()
	})

	it.each(["cancelled", "failed"] as const)(
		"keeps one honest row for a turn that %s before a word",
		async (outcome) => {
			const harness = await bootedHarness()
			await streamed(harness, [
				...toolRounds(3),
				{
					type: "messageStarted",
					message: { ...STREAMING_MESSAGE, id: "msg-cut" },
				},
				{
					type: "messageCompleted",
					message: { ...STREAMING_MESSAGE, id: "msg-cut", completion: outcome },
				},
				ended(outcome),
			])

			const state = harness.controller.getState()
			expect(spoken(state.messages)).toEqual([
				["user", "hello", "complete"],
				["assistant", "", outcome],
			])
			expect(spoken(await reload(harness.store))).toEqual(
				spoken(state.messages),
			)
			harness.detach()
		},
	)

	it("keeps one honest row when the session dies between two tools", async () => {
		const harness = await bootedHarness()
		await streamed(harness, toolRounds(2))

		await harness.controller.restart()
		await vi.runAllTimersAsync()

		expect(spoken(harness.controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", "", "interrupted"],
		])
		harness.detach()
	})
})
