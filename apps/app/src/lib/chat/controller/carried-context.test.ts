import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	expectWholeChat,
	HISTORY,
	occurrences,
	REFUSED_REFERENCE,
	REPLY,
	reasons,
	reload,
	runOf,
	spoken,
	told,
	withHistory,
} from "./controller-fixtures"

import { NEARING_THE_BOUND, REFUSED } from "../rotation"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import type { TranscriptStore } from "../../conversations/store-port"

const REFUSAL = {
	kind: "storage",
	failure: { kind: "poisonedConnection" },
}

const refusingStoreAt = (
	member: "captureCheckpoint" | "boundedContext",
): TranscriptStore & { refuse: (on: boolean) => void } => {
	const base = withHistory()
	let refusing = false
	const refused = () => Promise.reject(REFUSAL)
	return {
		...base,
		refuse: (on: boolean) => {
			refusing = on
		},
		captureCheckpoint: (conversationId, botId, runtimeSessionId, at) =>
			refusing && member === "captureCheckpoint"
				? refused()
				: base.captureCheckpoint(conversationId, botId, runtimeSessionId, at),
		boundedContext: (
			conversationId,
			botId,
			runtimeSessionId,
			promptMessageId,
		) =>
			refusing && member === "boundedContext"
				? refused()
				: base.boundedContext(
						conversationId,
						botId,
						runtimeSessionId,
						promptMessageId,
					),
	}
}

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("passes the first prompt of a run whose checkpoint the store refused", async () => {
		const store: TranscriptStore = {
			...createFakeTranscriptStore(),
			captureCheckpoint: () => Promise.reject(REFUSED_REFERENCE),
		}
		const { controller, driver } = await bootedHarness({ store })
		const submitSpy = vi.spyOn(driver, "submitPrompt")

		await controller.send("hello")
		await vi.runAllTimersAsync()

		expect(submitSpy).toHaveBeenCalledTimes(1)
		expect(controller.getState().errors.at(-1)?.error).toEqual({
			kind: "writeFailed",
			detail:
				"the transcript store refused it (storage, sqlite: FOREIGN KEY constraint failed)",
		})
	})
})

describe("a run replaced under a conversation that carries on", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("retires no run while the fold its successor needs is refused", async () => {
		const store = refusingStoreAt("captureCheckpoint")
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver } = await bootedHarness({
			store,
			promptsPerRun: 1,
		})
		const submitted = vi.spyOn(driver, "submitPrompt")

		await controller.send("first")
		await vi.runAllTimersAsync()
		const holding = runOf(controller)
		store.refuse(true)
		await controller.send("second")
		await vi.runAllTimersAsync()

		expect(runOf(controller)).toEqual(holding)
		expect(reasons(opened, "default")).toEqual([null])
		expect(told(submitted)).toBe("second")
		expect(controller.getState().errors.at(-1)?.error).toEqual({
			kind: "writeFailed",
			detail: "the transcript store refused it (storage, poisonedConnection)",
		})
		expect(spoken(controller.getState().messages).at(-1)).toEqual([
			"assistant",
			REPLY,
			"complete",
		])

		store.refuse(false)
		await controller.send("third")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "default")).toEqual([null, NEARING_THE_BOUND])
		expect(runOf(controller).epoch).toBe(holding.epoch + 1)
		expectWholeChat(told(submitted), ["first", "second"])
		expect(occurrences(told(submitted), "third")).toBe(1)
	})

	it.each(["boundedContext"] as const)(
		"gives a run that was told nothing no prompt of its own when %s is refused",
		async (member) => {
			const store = refusingStoreAt(member)
			const { controller, driver } = await bootedHarness({ store })
			const submitted = vi.spyOn(driver, "submitPrompt")
			store.refuse(true)

			await controller.send("where were we?")
			await vi.runAllTimersAsync()

			const refused = controller.getState()
			expect(submitted).not.toHaveBeenCalled()
			expect(refused.turn).toBe("failed")
			expect(refused.errors.at(-1)?.error).toEqual({
				kind: "writeFailed",
				detail: "the transcript store refused it (storage, poisonedConnection)",
			})
			expect(spoken(refused.messages).at(-1)).toEqual([
				"user",
				"where were we?",
				"complete",
			])
			expect(refused.rejectedPromptId).toBe(refused.messages.at(-1)?.id)

			store.refuse(false)
			await controller.retry(refused.rejectedPromptId ?? "")
			await vi.runAllTimersAsync()

			expect(submitted).toHaveBeenCalledTimes(1)
			expectWholeChat(told(submitted), [])
			expect(occurrences(told(submitted), "where were we?")).toBe(1)
			const state = controller.getState()
			expect(state.turn).toBe("idle")
			expect(spoken(state.messages).slice(-2)).toEqual([
				["user", "where were we?", "complete"],
				["assistant", REPLY, "complete"],
			])
			expect(spoken(await reload(store)).slice(-2)).toEqual(
				spoken(state.messages).slice(-2),
			)
		},
	)

	it("never lets a spent run answer on its own while the fold is refused", async () => {
		const store = refusingStoreAt("captureCheckpoint")
		const opened = vi.spyOn(store, "openRuntimeSession")
		const { controller, driver } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")

		await controller.send("first")
		await vi.runAllTimersAsync()
		const spent = runOf(controller)
		driver.pushEvent({
			type: "failed",
			error: { kind: "resumeFailed", forgotSessionId: true },
		})
		await vi.runAllTimersAsync()
		store.refuse(true)
		submitted.mockClear()

		await controller.send("where were we?")
		await vi.runAllTimersAsync()

		expect(runOf(controller)).toEqual(spent)
		expect(reasons(opened, "default")).toEqual([null])
		expect(submitted).not.toHaveBeenCalled()
		expect(controller.getState().rejectedPromptId).toBe(
			controller.getState().messages.at(-1)?.id,
		)

		store.refuse(false)
		await controller.send("and now?")
		await vi.runAllTimersAsync()

		expect(reasons(opened, "default")).toEqual([null, REFUSED])
		expect(runOf(controller).epoch).toBe(spent.epoch + 1)
		expect(submitted).toHaveBeenCalledTimes(1)
		expectWholeChat(told(submitted), ["first", "where were we?"])
		expect(occurrences(told(submitted), "and now?")).toBe(1)
	})

	it("leaves no stretch of the chat between the summary and the tail", async () => {
		const store = withHistory()
		const { controller, driver } = await bootedHarness({ store })
		const submitted = vi.spyOn(driver, "submitPrompt")

		await controller.send("where were we?")
		await vi.runAllTimersAsync()

		expect(told(submitted)).toContain("stored 1\n")
		expect(told(submitted)).toContain(`stored ${HISTORY}`)
		for (let index = 1; index <= HISTORY; index += 1) {
			expect(told(submitted)).toContain(`stored ${index}\n`)
		}
		expect(occurrences(told(submitted), "where were we?")).toBe(1)
	})
})

describe("a run replaced under a conversation that carries on", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("carries the stored conversation into the first prompt of a cold launch", async () => {
		const store = withHistory()
		const first = await bootedHarness({ store })
		first.controller.redescribe(BOT)
		await first.controller.send("still there?")
		await vi.runAllTimersAsync()
		first.detach()

		const second = await bootedHarness({ store })
		const submitted = vi.spyOn(second.driver, "submitPrompt")
		await second.controller.send("where were we?")
		await vi.runAllTimersAsync()

		expect(told(submitted)).toContain("The conversation so far:")
		expect(told(submitted)).toContain(`stored ${HISTORY}`)
		expect(told(submitted)).toContain("The new message:\nwhere were we?")
		expect(occurrences(told(submitted), "where were we?")).toBe(1)
		second.detach()
	})
})
