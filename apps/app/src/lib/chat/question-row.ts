import type { TranscriptStore } from "../conversations/store-port"
import type { TranscriptDraft } from "../conversations/transcript-contract"

export const storeQuestionRow = async (
	store: TranscriptStore,
	row: TranscriptDraft,
) => {
	await store.openAssistantMessage({
		id: row.id,
		conversationId: row.conversationId,
		turnId: row.turnId,
		authorBotId: row.authorBotId,
		repliedToMessageId: row.repliedToMessageId,
		createdAt: row.createdAt,
	})
	await store.appendText(row.id, row.content)
	await store.finalizeMessage(row.id, "complete")
}
