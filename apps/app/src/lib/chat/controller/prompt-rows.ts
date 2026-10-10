import type { ChatContext } from "./chat-context"

export type PromptRows = ReturnType<typeof createPromptRows>

export const createPromptRows = ({
	store,
	transcript,
	newId,
	now,
	senderAccountId,
}: ChatContext) => {
	const promptRow = (
		conversationId: string,
		content: string,
		repliedToMessageId?: string,
	) => ({
		id: newId(),
		turnId: newId(),
		conversationId,
		content,
		createdAt: now(),
		repliedToMessageId: repliedToMessageId ?? null,
	})

	type PromptRow = ReturnType<typeof promptRow>

	const storePrompt = (said: PromptRow, summoned: string[]) =>
		store.sendUserMessage(
			{
				id: said.id,
				conversationId: said.conversationId,
				turnId: said.turnId,
				authorBotId: null,
				repliedToMessageId: said.repliedToMessageId,
				content: said.content,
				createdAt: said.createdAt,
			},
			summoned,
		)

	const showPrompt = (said: PromptRow) =>
		transcript.append({
			id: said.id,
			conversationId: said.conversationId,
			turnId: said.turnId,
			role: "user",
			content: said.content,
			completion: "complete",
			createdAt: said.createdAt,
			authorBotId: null,
			authorAccountId: senderAccountId(),
			authorName: null,
			repliedToMessageId: said.repliedToMessageId,
			runtimeSessionId: null,
		})

	return { promptRow, storePrompt, showPrompt }
}
