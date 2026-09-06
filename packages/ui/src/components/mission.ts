import type { BotBadge } from "@workspace/ui/components/badge"
import type { BotIdentityAvatarProps } from "@workspace/ui/components/bot-identity-avatar"
import type { MessageAuthor } from "@workspace/ui/components/message"
import type { RosterBot } from "@workspace/ui/components/roster"

type MissionEventKind =
	| "opened"
	| "note"
	| "agent_asked"
	| "answered"
	| "escalated"
	| "ready"
	| "failed"
	| "closed"

type MissionState =
	| "working"
	| "waiting_bot"
	| "waiting_human"
	| "ready_to_merge"
	| "failed"
	| "done"

const MISSION_AVATAR_SIZE = 24

type MissionBot = Pick<
	BotIdentityAvatarProps,
	"animal" | "blot" | "image" | "seed"
> & { name: string }

type MissionTicket = {
	externalId: string
	title: string
}

type MissionTicketLink = MissionTicket & {
	platform: string
	url: string
}

type MissionCardModel = {
	id: string
	identity: RosterBot
	author?: MessageAuthor
	objective: string
	ticket: MissionTicketLink
	tools: string[]
	state: MissionState
	isClosed: boolean
}

type MissionEventModel = {
	id: string
	kind: MissionEventKind
	source: string
	createdAt: number
	text?: string
}

const missionBadgeFor = (state: MissionState): BotBadge | undefined =>
	state === "waiting_human" ? "attention" : undefined

export {
	MISSION_AVATAR_SIZE,
	type MissionBot,
	type MissionCardModel,
	type MissionEventKind,
	type MissionEventModel,
	type MissionState,
	type MissionTicket,
	type MissionTicketLink,
	missionBadgeFor,
}
