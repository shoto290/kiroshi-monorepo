import {
	type ChatState,
	initialChatState,
	isSessionReady,
	isTurnBusy,
} from "../chat-state"
import type { PostedQuestion } from "../posted-question"
import {
	EVOLVED,
	type LiveRun,
	openedRun,
	type RotationReason,
	rotationReasonForFailure,
} from "../rotation"
import type {
	AgentCommand,
	AgentEvent,
	ChatMessage,
	SessionHandle,
	TransportError,
} from "../../agent/contract"

export type TransitionKind = "close" | `open:${string}`

export type BotTransition = {
	kind: TransitionKind
	settled: Promise<unknown>
}

type Opening = {
	kind: TransitionKind
	landed: Promise<void>
}

type ActiveTurn = {
	id: string
	promptId: string
	conversationId: string
}

export type BotChat = {
	id: string
	state: ChatState
	run: LiveRun
	activeTurn: ActiveTurn | null
	posted: PostedQuestion[]
	heldReply: ChatMessage | null
	openMessages: Map<string, number>
	settledMessages: Set<string>
	commands: { stored: AgentCommand[]; announced: boolean }
	pendingPreflight: Promise<SessionHandle | null> | null
	pendingRotation: Promise<SessionHandle | null> | null
	opening: Opening | null
	mutesResumeRefusal: boolean
	sending: boolean
	draining: Promise<void> | null
}

export const newBotChat = (id: string): BotChat => ({
	id,
	state: initialChatState,
	run: openedRun(false),
	activeTurn: null,
	posted: [],
	heldReply: null,
	openMessages: new Map(),
	settledMessages: new Set(),
	commands: { stored: [], announced: false },
	pendingPreflight: null,
	pendingRotation: null,
	opening: null,
	mutesResumeRefusal: false,
	sending: false,
	draining: null,
})

export const postedIn = (bot: BotChat, conversationId: string) =>
	bot.posted.filter((posted) => posted.conversationId === conversationId)

export const isUnwritten = (bot: BotChat, id: string) =>
	!bot.openMessages.has(id) && !bot.settledMessages.has(id)

export const isMutedRefusal = (bot: BotChat, error: TransportError) =>
	bot.mutesResumeRefusal && error.kind === "resumeFailed"

export const isMutedFailure = (bot: BotChat, event: AgentEvent) =>
	event.type === "failed" && isMutedRefusal(bot, event.error)

export const noteFailure = (bot: BotChat, event: AgentEvent) => {
	if (event.type !== "failed") {
		return
	}
	const reason = rotationReasonForFailure(event.error)
	if (!reason) {
		return
	}
	bot.run.spent ??= reason
	bot.run.carried = false
}

export const spend = (bot: BotChat, reason: RotationReason) => {
	if (!bot.state.sessionOpen) {
		return
	}
	bot.run.spent ??= reason
}

export const noteEvolution = (bot: BotChat, event: AgentEvent) => {
	if (event.type !== "botEvolved") {
		return
	}
	spend(bot, EVOLVED)
}

export const isAnswerable = (bot: BotChat) =>
	bot.state.sessionOpen && bot.run.spent === null

export const submittedTurnOf = ({ activeTurn }: BotChat) =>
	activeTurn
		? { turnId: activeTurn.id, promptId: activeTurn.promptId }
		: undefined

export const isRunOutsideOpenThread = (bot: BotChat) => {
	const runtime = bot.state.runtime
	return runtime !== null && runtime.conversationId !== bot.state.conversationId
}

export const canDeliver = (bot: BotChat) =>
	!bot.sending &&
	bot.state.conversationId !== null &&
	!isTurnBusy(bot.state.turn)

export const canSend = (bot: BotChat) =>
	canDeliver(bot) && isSessionReady(bot.state)

export const pendingPostOf = (bot: BotChat, id: string) =>
	bot.state.question?.id === id
		? bot.posted.find((posted) => posted.request.id === id)
		: undefined

export const changePosted = (
	bot: BotChat,
	id: string,
	change: Partial<PostedQuestion>,
) => {
	bot.posted = bot.posted.map((known) =>
		known.request.id === id ? { ...known, ...change } : known,
	)
}
