import { useMemo } from "react"

import type { Mission } from "./mission-contract"
import { type LiveMissionIds, liveMissionsIn } from "./missions-model"

import {
	type SubscribableRuntimes,
	useHeldRecord,
} from "@/lib/conversations/use-conversation"

type SpeakingThread = {
	getState: () => { speakers: { botId: string }[] }
}

export type MissionSpeakingRuntimes = SubscribableRuntimes & {
	heldFor: (conversationId: string) => SpeakingThread | null
}

const NO_SPEAKING_BOT_IDS: string[] = []

const speakingBotIdsIn = (thread: SpeakingThread | null): string[] =>
	thread?.getState().speakers.map(({ botId }) => botId) ?? NO_SPEAKING_BOT_IDS

export const useLiveMissions = (
	runtimes: MissionSpeakingRuntimes,
	missions: Mission[],
	now: number,
): LiveMissionIds => {
	const speakingBotIds = useHeldRecord(
		runtimes,
		missions.map(({ threadConversationId }) => threadConversationId),
		(conversationId) => speakingBotIdsIn(runtimes.heldFor(conversationId)),
		(botIds) => botIds.join(","),
	)

	return useMemo(
		() => liveMissionsIn({ missions, speakingBotIds, now }),
		[missions, speakingBotIds, now],
	)
}
