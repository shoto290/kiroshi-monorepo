import type { StorageFailure } from "@/lib/conversations/store-contract"
import type { MissionState } from "@/lib/missions/mission-contract"

export type ChatKind = "main" | "topic" | "mission"

export type CatalogueChat = {
	conversationId: string
	kind: ChatKind
	title: string
	botId: string | null
	participants: string[]
	spaceId: string | null
}

export type CatalogueMission = {
	id: string
	threadConversationId: string
	objective: string
	ticketPlatform: string
	ticketExternalId: string
	state: MissionState
	botId: string
	spaceId: string
}

export type CatalogueRoutine = {
	id: string
	conversationId: string
	botId: string
	title: string
	triggerSourceId: string
	isEnabled: boolean
	expression: string | null
	spaceId: string
}

export type Catalogue = {
	chats: CatalogueChat[]
	missions: CatalogueMission[]
	routines: CatalogueRoutine[]
}

export type CatalogueError =
	| { kind: "unavailable"; failure: StorageFailure }
	| { kind: "storage"; failure: StorageFailure }
	| { kind: "queryTooLong"; limit: number }
	| { kind: "unknownBot"; id: string }
