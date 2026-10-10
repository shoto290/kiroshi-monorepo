import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	expectWholeChat,
	HISTORY,
	occurrences,
	REPLY,
	reasons,
	reload,
	runOf,
	spoken,
	told,
	withHistory,
} from "./controller-fixtures"

import {
	EVOLVED,
	NEARING_THE_BOUND,
	REDESCRIBED,
	REFUSED,
	STOPPED,
} from "../rotation"
import type { AgentEvent } from "../../agent/contract"
import type { TranscriptStore } from "../../conversations/store-port"
import { botIdentity } from "../../conversations/transcript-fixtures"

const EVOLUTION: AgentEvent = {
	type: "botEvolved",
	bundle: "bot",
	commitId: "c-1",
	title: "learned to count",
}

const rotated = (opened: { mock: { calls: unknown[][] } }, botId: string) =>
	opened.mock.calls
		.filter((call) => call[1] === botId)
		.map((call) => call[3] ?? null)

describe("a run replaced under a conversation that carries on", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("replaces a run that has carried its share and hands the new one the conversation", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const captured = vi.spyOn(store, "captureCheckpoint")
		const { controller, driver } = await bootedHarness({
			store,
			promptsPerRun: 1,
		})
		const submitted = vi.spyOn(driver, "submitPrompt")
		const first = runOf(controller)
		const before = controller.getState().messages

		await controller.send("first")
		await vi.runAllTimersAsync()
		const carried = runOf(controller)
		await controller.send("second")
		await vi.runAllTimersAsync()

		expect(carried).toEqual(first)
		expect(reasons(opened, "default")).toEqual([null, NEARING_THE_BOUND])
		expect(rotated(opened, "default")).toEqual([null, first.runtimeSessionId])
		expect(captured.mock.calls.map((call) => call[2])).toContain(
			first.runtimeSessionId,
		)
		expect(runOf(controller).epoch).toBe(first.epoch + 1)
		expect(told(submitted)).toContain("The new message:\nsecond")
		expect(occurrences(told(submitted), "second")).toBe(1)

		const state = controller.getState()
		expect(state.messages.slice(0, before.length)).toEqual(before)
		expect(spoken(state.messages).slice(-4)).toEqual([
			["user", "first", "complete"],
			["assistant", REPLY, "complete"],
			["user", "second", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(spoken(await reload(store)).slice(-4)).toEqual(
			spoken(state.messages).slice(-4),
		)
	})

	it("replaces a run whose provider session was refused, on the next prompt", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")
		const refused = runOf(controller)

		driver.pushEvent({
			type: "failed",
			error: { kind: "resumeFailed", forgotSessionId: true },
		})
		await vi.runAllTimersAsync()
		expect(runOf(controller)).toEqual(refused)

		await controller.send("where were we?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "default")).toEqual([null, REFUSED])
		expect(runOf(controller).runtimeSessionId).not.toBe(
			refused.runtimeSessionId,
		)
		expect(told(submitted)).toContain(`stored ${HISTORY}`)
		expect(occurrences(told(submitted), "where were we?")).toBe(1)
		expect(controller.getState().messages.at(-1)?.completion).toBe("complete")
	})

	it("replaces a run the provider stopped answering in", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")

		await controller.send("hello")
		await vi.runAllTimersAsync()
		const spent = runOf(controller)
		driver.pushEvent({
			type: "failed",
			error: { kind: "crashed", code: 9, detail: "claude exited unexpectedly" },
		})
		await vi.runAllTimersAsync()

		await controller.send("still there?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "default")).toEqual([null, STOPPED])
		expect(runOf(controller).runtimeSessionId).not.toBe(spent.runtimeSessionId)
		expect(told(submitted)).toContain("The new message:\nstill there?")
		expect(told(submitted)).toContain("user: hello")
		expect(controller.getState().turn).toBe("idle")
		expect(spoken(controller.getState().messages).at(-1)).toEqual([
			"assistant",
			REPLY,
			"complete",
		])
	})

	it("replaces the run of a companion that was described again, on the next prompt", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver, detach } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")
		const started = vi.spyOn(driver, "startOrResumeSession")
		const described = runOf(controller)
		const before = controller.getState().messages

		controller.redescribe(BOT)
		await vi.runAllTimersAsync()

		expect(started).not.toHaveBeenCalled()
		expect(reasons(opened, BOT)).toEqual([null])

		await controller.send("and now?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, BOT)).toEqual([null, REDESCRIBED])
		expect(runOf(controller).epoch).toBe(described.epoch + 1)
		expectWholeChat(told(submitted), [])
		expect(told(submitted)).toContain("The new message:\nand now?")
		expect(occurrences(told(submitted), "and now?")).toBe(1)
		expect(controller.getState().messages.slice(0, before.length)).toEqual(
			before,
		)
		expect(spoken(controller.getState().messages).slice(-2)).toEqual([
			["user", "and now?", "complete"],
			["assistant", REPLY, "complete"],
		])
		detach()
	})
})

describe("a run replaced under a conversation that carries on", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("retires the run of the companion that was described and no other", async () => {
		const store = withHistory()
		const other = await store.createBot(botIdentity({ name: "Second" }))
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, detach } = await bootedHarness({ store })
		await controller.open(other.id, null)
		await vi.runAllTimersAsync()

		controller.redescribe("nobody")
		controller.redescribe(BOT)
		await controller.send("and me?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "nobody")).toEqual([])
		expect(reasons(opened, other.id)).toEqual([null])

		await controller.open(BOT, null)
		await vi.runAllTimersAsync()

		expect(reasons(opened, BOT)).toEqual([null, REDESCRIBED])
		expect(reasons(opened, other.id)).toEqual([null])
		detach()
	})

	it("replaces the run of a companion that evolved, on the next prompt", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver, detach } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")
		const started = vi.spyOn(driver, "startOrResumeSession")
		const evolved = runOf(controller)
		const before = controller.getState().messages

		driver.pushEvent(EVOLUTION, evolved)
		await vi.runAllTimersAsync()

		expect(started).not.toHaveBeenCalled()
		expect(reasons(opened, BOT)).toEqual([null])
		expect(controller.getState().messages).toEqual(before)

		await controller.send("and now?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, BOT)).toEqual([null, EVOLVED])
		expect(runOf(controller).epoch).toBe(evolved.epoch + 1)
		expectWholeChat(told(submitted), [])
		expect(told(submitted)).toContain("The new message:\nand now?")
		expect(spoken(controller.getState().messages).slice(-2)).toEqual([
			["user", "and now?", "complete"],
			["assistant", REPLY, "complete"],
		])
		detach()
	})

	it("ignores an evolution reported under a run it does not hold", async () => {
		const store = withHistory()
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver, detach } = await bootedHarness({ store })
		const started = vi.spyOn(driver, "startOrResumeSession")

		driver.pushEvent(EVOLUTION, null)
		await vi.runAllTimersAsync()
		await controller.send("and now?")
		await vi.runAllTimersAsync()

		expect(started).not.toHaveBeenCalled()
		expect(reasons(opened, BOT)).toEqual([null])
		detach()
	})

	it("keeps two companions' runs and recovery points apart in one chat", async () => {
		const held = withHistory()
		const store: TranscriptStore = {
			...held,
			mainChat: () => held.mainChat(BOT),
		}
		const opened = vi.spyOn(store, "openRuntimeSession")
		const captured = vi.spyOn(store, "captureCheckpoint")
		const first = await bootedHarness({ store })
		const second = await bootedHarness({ store, botId: "second" })
		const spoke = vi.spyOn(second.driver, "submitPrompt")
		const replaced = runOf(first.controller)

		first.controller.redescribe(BOT)
		await first.controller.send("and you?")
		await vi.runAllTimersAsync()
		await second.controller.send("and me?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "default")).toEqual([null, REDESCRIBED])
		expect(reasons(opened, "second")).toEqual([null])
		expect(runOf(first.controller).epoch).toBe(2)
		expect(runOf(second.controller).epoch).toBe(1)
		expect(runOf(second.controller).botId).toBe("second")
		expect(captured.mock.calls.map((call) => [call[1], call[2]])).toEqual([
			["default", replaced.runtimeSessionId],
			["default", runOf(first.controller).runtimeSessionId],
			["second", runOf(second.controller).runtimeSessionId],
		])
		expect(told(spoke)).toContain(`stored ${HISTORY}`)
		expect(occurrences(told(spoke), "and me?")).toBe(1)

		first.detach()
		second.detach()
	})
})
