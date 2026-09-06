import { useMemo } from "react"

import type { Mission } from "./mission-contract"
import type { WaitingMissionIds } from "./missions-model"

import type { PendingPrompt } from "@/lib/conversations/conversation-controller"
import {
	type SubscribableRuntimes,
	useHeldRecord,
} from "@/lib/conversations/use-conversation"

type AwaitedThread = {
	getState: () => { pendingPrompt: PendingPrompt | null }
}

export type MissionThreadRuntimes = SubscribableRuntimes & {
	heldFor: (conversationId: string) => AwaitedThread | null
}

const NO_BOT = ""

const awaitedBotIdIn = (thread: AwaitedThread | null): string =>
	thread?.getState().pendingPrompt?.botId ?? NO_BOT

export const useWaitingMissions = (
	runtimes: MissionThreadRuntimes,
	missions: Mission[],
): WaitingMissionIds => {
	const awaitedBotIds = useHeldRecord(
		runtimes,
		missions.map(({ threadConversationId }) => threadConversationId),
		(conversationId) => awaitedBotIdIn(runtimes.heldFor(conversationId)),
		(botId) => botId,
	)

	return useMemo(
		() =>
			new Set(
				missions
					.filter(
						({ botId, threadConversationId }) =>
							awaitedBotIds[threadConversationId] === botId,
					)
					.map(({ id }) => id),
			),
		[missions, awaitedBotIds],
	)
}
