// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Mission } from "./mission-contract"
import { aMission } from "./mission-fixtures"
import {
	type MissionThreadRuntimes,
	useWaitingMissions,
} from "./use-waiting-missions"

import type { PendingPrompt } from "../conversations/conversation-controller"

const MISSION = aMission({
	id: "m-1",
	botId: "bot-1",
	threadConversationId: "thread-1",
})

const question = (botId: string): PendingPrompt => ({
	kind: "question",
	botId,
	request: { id: "q-1", questions: [] },
})

const permission = (botId: string): PendingPrompt => ({
	kind: "permission",
	botId,
	request: { id: "p-1", toolName: "Bash", title: "Run it", detail: null },
})

const createFakeRuntimes = () => {
	const prompts = new Map<string, PendingPrompt | null>()
	const listeners = new Set<() => void>()

	const runtimes: MissionThreadRuntimes = {
		heldFor: (conversationId) =>
			prompts.has(conversationId)
				? {
						getState: () => ({
							pendingPrompt: prompts.get(conversationId) ?? null,
						}),
					}
				: null,
		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}

	const publish = (conversationId: string, prompt: PendingPrompt | null) => {
		act(() => {
			prompts.set(conversationId, prompt)
			for (const listener of [...listeners]) {
				listener()
			}
		})
	}

	return { runtimes, publish }
}

const waitingIn = (runtimes: MissionThreadRuntimes, missions: Mission[]) =>
	renderHook(() => useWaitingMissions(runtimes, missions))

afterEach(cleanup)

describe("useWaitingMissions", () => {
	it("holds a mission whose thread asks its bot a question", () => {
		const { runtimes, publish } = createFakeRuntimes()
		const { result } = waitingIn(runtimes, [MISSION])

		publish("thread-1", question("bot-1"))

		expect([...result.current]).toEqual(["m-1"])
	})

	it("holds a mission whose thread asks its bot a permission", () => {
		const { runtimes, publish } = createFakeRuntimes()
		const { result } = waitingIn(runtimes, [MISSION])

		publish("thread-1", permission("bot-1"))

		expect([...result.current]).toEqual(["m-1"])
	})

	it("drops the mission once the prompt is answered", () => {
		const { runtimes, publish } = createFakeRuntimes()
		const { result } = waitingIn(runtimes, [MISSION])
		publish("thread-1", question("bot-1"))

		publish("thread-1", null)

		expect([...result.current]).toEqual([])
	})

	it("holds nothing for a thread no runtime is held for", () => {
		const { runtimes } = createFakeRuntimes()
		const { result } = waitingIn(runtimes, [MISSION])

		expect([...result.current]).toEqual([])
	})

	it("holds nothing when the thread waits on another bot", () => {
		const { runtimes, publish } = createFakeRuntimes()
		const { result } = waitingIn(runtimes, [MISSION])

		publish("thread-1", question("bot-2"))

		expect([...result.current]).toEqual([])
	})

	it("holds the same set while nothing moves", () => {
		const { runtimes, publish } = createFakeRuntimes()
		const missions = [MISSION]
		const { result, rerender } = waitingIn(runtimes, missions)
		publish("thread-1", question("bot-1"))
		const held = result.current

		rerender()

		expect(result.current).toBe(held)
	})
})
