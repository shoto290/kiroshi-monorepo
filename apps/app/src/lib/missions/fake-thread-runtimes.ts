import { act } from "@testing-library/react"

import type { MissionThreadRuntimes } from "./use-waiting-missions"

import type { PendingPrompt } from "../conversations/conversation-controller"

export type FakeThreadRuntimes = {
	runtimes: MissionThreadRuntimes
	publish: (conversationId: string, prompt: PendingPrompt | null) => void
}

export const createFakeThreadRuntimes = (): FakeThreadRuntimes => {
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
