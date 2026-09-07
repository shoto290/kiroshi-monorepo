import type { StorageFailure } from "@/lib/conversations/store-contract"

export type ConversationKind = "main" | "topic" | "mission"

export type MessageSearchQuery = {
	text: string
	spaceId: string
	allSpaces: boolean
}

export type SnippetPart = {
	text: string
	matched: boolean
}

export type MessageHit = {
	messageId: string
	seq: number
	conversationId: string
	conversationKind: ConversationKind
	conversationTitle: string
	authorBotId: string | null
	createdAt: number
	spaceId: string | null
	snippet: SnippetPart[]
}

export type MessageSearchError =
	| { kind: "unavailable"; failure: StorageFailure }
	| { kind: "storage"; failure: StorageFailure }
	| { kind: "queryTooLong"; limit: number }
