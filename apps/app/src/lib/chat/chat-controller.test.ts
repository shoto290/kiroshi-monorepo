import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	bootedHarness,
	REPLY,
	reload,
	spoken,
} from "./controller/controller-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("runs a happy-path turn and stores everything the reader can see", async () => {
		const { controller, store, detach } = await bootedHarness()

		await controller.send("hello")
		expect(controller.getState().turn).toBe("submitting")

		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.turn).toBe("idle")
		expect(spoken(state.messages)).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
		expect(state.activities.at(-1)?.status).toBe("succeeded")
		expect(state.errors).toEqual([])
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
		detach()
	})

	it("stops notifying detached listeners", async () => {
		const { controller, detach } = await bootedHarness()
		detach()
		await vi.runAllTimersAsync()

		await controller.send("hello")
		await vi.runAllTimersAsync()

		expect(spoken(controller.getState().messages)).toEqual([
			["user", "hello", "complete"],
		])
	})
})
