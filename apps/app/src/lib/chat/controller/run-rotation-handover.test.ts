import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	ANNOUNCED,
	BOT,
	bootedHarness,
	deferred,
	ended,
	headed,
	REPLY,
	ROUNDS,
	recordingStore,
	reload,
	runOf,
	spoken,
	spokenAnswer,
	toolRounds,
} from "./controller-fixtures"

import type { ChatDriver } from "../driver"
import type { FakeChatDriver } from "../fake-driver"
import type { RuntimeScope } from "../../agent/contract"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import type { TranscriptStore } from "../../conversations/store-port"

type Watched = {
	starts: RuntimeScope[]
	submits: [RuntimeScope, string][]
}

const watchedDriver =
	(watched: Watched, failing: () => boolean) =>
	(fake: FakeChatDriver): ChatDriver => ({
		...fake,
		startOrResumeSession: (scope, resume) => {
			watched.starts.push(scope)
			return failing()
				? Promise.reject({ kind: "spawnFailed", detail: "no child came up" })
				: fake.startOrResumeSession(scope, resume)
		},
		submitPrompt: (scope, text) => {
			watched.submits.push([scope, text])
			return fake.submitPrompt(scope, text)
		},
	})

const watching = (): Watched => ({ starts: [], submits: [] })

const foldingStore = (base: TranscriptStore, held: Promise<void>) => {
	let holding = false
	return {
		store: {
			...base,
			captureCheckpoint: async (
				conversationId: string,
				botId: string,
				runtimeSessionId: string,
				createdAt: number,
			) => {
				if (holding) {
					await held
				}
				return base.captureCheckpoint(
					conversationId,
					botId,
					runtimeSessionId,
					createdAt,
				)
			},
		} as TranscriptStore,
		hold: (on: boolean) => {
			holding = on
		},
	}
}

describe("a handover nothing may run twice", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("gives no prompt to a run whose process never came up, and hands over again next time", async () => {
		const store = createFakeTranscriptStore()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const watched = watching()
		let failing = false
		const harness = await bootedHarness({
			store,
			promptsPerRun: 1,
			driver: watchedDriver(watched, () => failing),
		})
		await harness.controller.send("first")
		await vi.runAllTimersAsync()
		const carried = runOf(harness.controller)

		failing = true
		await harness.controller.send("second")
		await vi.runAllTimersAsync()

		const dead = runOf(harness.controller)
		const refused = harness.controller.getState()
		expect(dead.runtimeSessionId).not.toBe(carried.runtimeSessionId)
		expect(watched.submits.map(([scope]) => scope)).not.toContainEqual(dead)
		expect(refused.turn).toBe("failed")
		expect(spoken(refused.messages).at(-1)).toEqual([
			"user",
			"second",
			"complete",
		])
		expect(refused.rejectedPromptId).toBe(refused.messages.at(-1)?.id)

		failing = false
		await harness.controller.send("third")
		await vi.runAllTimersAsync()

		const live = runOf(harness.controller)
		expect(live.runtimeSessionId).not.toBe(dead.runtimeSessionId)
		expect(opened).toHaveBeenCalledTimes(3)
		expect(watched.submits.at(-1)?.[0]).toEqual(live)
		expect(watched.submits.at(-1)?.[1]).toContain("second")
		expect(watched.submits.at(-1)?.[1]).toContain("third")
		expect(harness.controller.getState().turn).toBe("idle")
		harness.detach()
	})

	it("hands over before retrying a prompt the dead run refused", async () => {
		const store = createFakeTranscriptStore()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const watched = watching()
		let failing = false
		const harness = await bootedHarness({
			store,
			promptsPerRun: 1,
			driver: watchedDriver(watched, () => failing),
		})
		await harness.controller.send("first")
		await vi.runAllTimersAsync()

		failing = true
		await harness.controller.send("second")
		await vi.runAllTimersAsync()
		const dead = runOf(harness.controller)
		const rejected = harness.controller.getState().rejectedPromptId ?? ""
		const written = harness.controller.getState().messages.length

		failing = false
		await harness.controller.retry(rejected)
		await vi.runAllTimersAsync()

		const live = runOf(harness.controller)
		const state = harness.controller.getState()
		expect(opened).toHaveBeenCalledTimes(3)
		expect(live.runtimeSessionId).not.toBe(dead.runtimeSessionId)
		expect(watched.submits.map(([scope]) => scope)).not.toContainEqual(dead)
		expect(watched.submits.at(-1)?.[0]).toEqual(live)
		expect(watched.submits.at(-1)?.[1]).toContain("second")
		expect(state.messages).toHaveLength(written + 1)
		expect(state.rejectedPromptId).toBeNull()
		expect(spoken(state.messages).at(-1)).toEqual([
			"assistant",
			REPLY,
			"complete",
		])
		harness.detach()
	})

	it("lets the live run it could not replace answer the prompt itself", async () => {
		const base = createFakeTranscriptStore()
		let refusing = false
		const store: TranscriptStore = {
			...base,
			openRuntimeSession: (
				conversationId,
				botId,
				startedAt,
				runtimeSessionId,
				reason,
			) =>
				refusing
					? Promise.reject({
							kind: "storage",
							failure: { kind: "poisonedConnection" },
						})
					: base.openRuntimeSession(
							conversationId,
							botId,
							startedAt,
							runtimeSessionId,
							reason,
						),
		}
		const watched = watching()
		const harness = await bootedHarness({
			store,
			promptsPerRun: 1,
			driver: watchedDriver(watched, () => false),
		})
		await harness.controller.send("first")
		await vi.runAllTimersAsync()
		const holding = runOf(harness.controller)

		refusing = true
		await harness.controller.send("second")
		await vi.runAllTimersAsync()

		const state = harness.controller.getState()
		expect(runOf(harness.controller)).toEqual(holding)
		expect(watched.starts).toHaveLength(1)
		expect(watched.submits.at(-1)).toEqual([
			holding,
			await headed(harness, "second"),
		])
		expect(spoken(state.messages).at(-1)).toEqual([
			"assistant",
			REPLY,
			"complete",
		])
		expect(state.turn).toBe("idle")
		harness.detach()
	})
})

describe("a handover nothing may run twice", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("holds the second of two prompts at the threshold for its own handover", async () => {
		const base = createFakeTranscriptStore()
		const released = deferred()
		const { store, hold } = foldingStore(base, released.promise)
		const opened = vi.spyOn(store, "openRuntimeSession")
		const watched = watching()
		const harness = await bootedHarness({
			store,
			promptsPerRun: 1,
			driver: watchedDriver(watched, () => false),
		})
		await harness.controller.send("first")
		await vi.runAllTimersAsync()
		const carried = runOf(harness.controller)

		hold(true)
		const second = harness.controller.send("second")
		await vi.advanceTimersByTimeAsync(0)
		const third = harness.controller.send("third")
		await vi.advanceTimersByTimeAsync(0)
		released.release()
		await Promise.all([second, third])
		await vi.runAllTimersAsync()

		const state = harness.controller.getState()
		expect(opened).toHaveBeenCalledTimes(3)
		expect(watched.starts).toHaveLength(3)
		expect(runOf(harness.controller).epoch).toBe(carried.epoch + 2)
		expect(watched.submits).toHaveLength(3)
		expect(watched.submits.at(-2)?.[1]).toContain("second")
		expect(watched.submits.at(-1)?.[1]).toContain("third")
		expect(spoken(state.messages)).toEqual([
			["user", "first", "complete"],
			["assistant", REPLY, "complete"],
			["user", "second", "complete"],
			["assistant", REPLY, "complete"],
			["user", "third", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(state.outbox).toEqual([])
		expect(state.errors).toEqual([])
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
		harness.detach()
	})

	it("keeps the provider id, the activities and the empty rows out under one handover", async () => {
		const { store, recorded } = recordingStore(createFakeTranscriptStore())
		const harness = await bootedHarness({ store })
		const replaced = runOf(harness.controller)

		harness.controller.redescribe(BOT)
		vi.spyOn(harness.driver, "submitPrompt").mockResolvedValue()
		await harness.controller.send("hello")
		const winner = runOf(harness.controller)
		harness.driver.pushEvent({ type: "turnChanged", state: "running" })
		for (const event of [
			{ type: "sessionReady", sessionId: ANNOUNCED, resumed: false } as const,
			...toolRounds(ROUNDS),
			...spokenAnswer(REPLY),
			ended("completed"),
		]) {
			harness.driver.pushEvent(event)
		}
		await vi.runAllTimersAsync()

		const state = harness.controller.getState()
		expect(winner.epoch).toBe(replaced.epoch + 1)
		expect(recorded).toEqual([[winner.runtimeSessionId, ANNOUNCED]])
		expect(
			state.activities.filter((entry) => entry.status === "succeeded"),
		).toHaveLength(ROUNDS)
		const stored = await reload(store)
		expect(spoken(stored)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(
			stored.filter(
				(message) => message.role === "assistant" && message.content === "",
			),
		).toEqual([])
		harness.detach()
	})
})
