import { act } from "@testing-library/react"

import type { MissionSpeakingRuntimes } from "./use-live-missions"
import type { MissionThreadRuntimes } from "./use-waiting-missions"

import type { PendingPrompt } from "../conversations/conversation-controller"

type ThreadReading = {
	pendingPrompt: PendingPrompt | null
	speakers: { botId: string }[]
}

const NOBODY: ThreadReading = { pendingPrompt: null, speakers: [] }

export type FakeThreadRuntimes = {
	runtimes: MissionThreadRuntimes & MissionSpeakingRuntimes
	publish: (conversationId: string, prompt: PendingPrompt | null) => void
	publishSpeakers: (conversationId: string, botIds: string[]) => void
}

export const createFakeThreadRuntimes = (): FakeThreadRuntimes => {
	const threads = new Map<string, ThreadReading>()
	const listeners = new Set<() => void>()

	const runtimes = {
		heldFor: (conversationId: string) => {
			const reading = threads.get(conversationId)
			return reading ? { getState: () => reading } : null
		},
		subscribe: (listener: () => void) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}

	const publishReading = (
		conversationId: string,
		reading: Partial<ThreadReading>,
	) => {
		act(() => {
			threads.set(conversationId, {
				...(threads.get(conversationId) ?? NOBODY),
				...reading,
			})
			for (const listener of [...listeners]) {
				listener()
			}
		})
	}

	return {
		runtimes,
		publish: (conversationId, pendingPrompt) =>
			publishReading(conversationId, { pendingPrompt }),
		publishSpeakers: (conversationId, botIds) =>
			publishReading(conversationId, {
				speakers: botIds.map((botId) => ({ botId })),
			}),
	}
}
