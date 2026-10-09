import type { Conversation } from "./store-contract"
import type { TranscriptStore } from "./store-port"

import { activeJoinedSpaceId } from "../host"

export type ConversationReader = Pick<
	TranscriptStore,
	"spaces" | "conversations"
>

const spaceIdsToRead = async (store: ConversationReader) => {
	const joinedSpaceId = activeJoinedSpaceId()
	if (joinedSpaceId) {
		return [joinedSpaceId]
	}
	const spaces = await store.spaces()
	return spaces.map(({ id }) => id)
}

export const readConversation = async (
	store: ConversationReader,
	conversationId: string,
): Promise<Conversation | null> => {
	const spaceIds = await spaceIdsToRead(store)
	const seated = await Promise.all(
		spaceIds.map((spaceId) => store.conversations(spaceId)),
	)
	return seated.flat().find(({ id }) => id === conversationId) ?? null
}
