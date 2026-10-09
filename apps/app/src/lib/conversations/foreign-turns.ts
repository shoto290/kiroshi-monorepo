import type { TerminalCompletion } from "./transcript-contract"
import type { TranscriptController } from "./transcript-controller"

import type {
	ActivityEvent,
	AgentEvent,
	ChatMessage,
	RuntimeScope,
	TurnState,
} from "../agent/contract"
import { isTurnBusy } from "../chat/chat-state"
import {
	ENDING_FOR,
	ENDING_FOR_OUTCOME,
	isWorthKeeping,
} from "../chat/reply-endings"
import { withActivity } from "../chat/working-kind"

export type ForeignSpeaker = {
	scope: RuntimeScope
	activities: ActivityEvent[]
	startedAt: number
	hasWritten: boolean
}

type ForeignTurn = {
	scope: RuntimeScope
	held: Map<string, ChatMessage>
	streamed: Map<string, number>
	hasWritten: boolean
	speaker: ForeignSpeaker | null
}

type ForeignTranscript = Pick<
	TranscriptController,
	"append" | "stream" | "settle"
>

export type ForeignTurns = {
	claim: (scope: RuntimeScope) => void
	render: (scope: RuntimeScope, event: AgentEvent) => void
	speakersIn: (conversationId: string) => ForeignSpeaker[]
}

const keyOf = ({ runtimeSessionId, epoch }: RuntimeScope) =>
	`${runtimeSessionId}:${epoch}`

export const createForeignTurns = (
	transcript: ForeignTranscript,
	now: () => number,
): ForeignTurns => {
	const claimed = new Set<string>()
	const turns = new Map<string, ForeignTurn>()

	const turnAt = (scope: RuntimeScope): ForeignTurn => {
		const key = keyOf(scope)
		const known = turns.get(key)
		if (known) {
			return known
		}
		const turn: ForeignTurn = {
			scope,
			held: new Map(),
			streamed: new Map(),
			hasWritten: false,
			speaker: null,
		}
		turns.set(key, turn)
		return turn
	}

	const stream = (turn: ForeignTurn, id: string, seq: number, text: string) => {
		const streamed = turn.streamed.get(id)
		if (text.length === 0 || streamed === undefined || seq <= streamed) {
			return
		}
		turn.streamed.set(id, seq)
		transcript.stream({ conversationId: turn.scope.conversationId, id, text })
	}

	const reviseSpeaker = (
		turn: ForeignTurn,
		revise: (speaker: ForeignSpeaker) => ForeignSpeaker,
	) => {
		if (turn.speaker) {
			turn.speaker = revise(turn.speaker)
		}
	}

	const noteWriting = (turn: ForeignTurn) => {
		if (turn.hasWritten) {
			return
		}
		turn.hasWritten = true
		reviseSpeaker(turn, (speaker) => ({ ...speaker, hasWritten: true }))
	}

	const openSpeaker = (turn: ForeignTurn) => {
		turn.speaker ??= {
			scope: turn.scope,
			activities: [],
			startedAt: now(),
			hasWritten: turn.hasWritten,
		}
	}

	const noteActivity = (turn: ForeignTurn, activity: ActivityEvent) => {
		openSpeaker(turn)
		reviseSpeaker(turn, (speaker) => ({
			...speaker,
			activities: withActivity(speaker.activities, activity),
		}))
	}

	const noteTurnState = (turn: ForeignTurn, state: TurnState) => {
		if (isTurnBusy(state)) {
			openSpeaker(turn)
		}
	}

	const closeSpeaker = (turn: ForeignTurn) => {
		turn.speaker = null
	}

	const open = (turn: ForeignTurn, message: ChatMessage) => {
		const { scope } = turn
		turn.held.delete(message.id)
		turn.streamed.set(message.id, 0)
		noteWriting(turn)
		transcript.append({
			id: message.id,
			conversationId: scope.conversationId,
			turnId: keyOf(scope),
			role: "assistant",
			content: "",
			completion: "streaming",
			createdAt: message.timestamp,
			authorBotId: scope.botId,
			authorAccountId: null,
			authorName: null,
			repliedToMessageId: null,
			runtimeSessionId: scope.runtimeSessionId,
		})
		stream(turn, message.id, 1, message.text)
	}

	const settle = (
		turn: ForeignTurn,
		id: string,
		completion: TerminalCompletion,
	) => {
		turn.streamed.delete(id)
		transcript.settle({
			conversationId: turn.scope.conversationId,
			id,
			completion,
		})
	}

	const start = (turn: ForeignTurn, message: ChatMessage) => {
		if (!turn.streamed.has(message.id)) {
			turn.held.set(message.id, message)
		}
	}

	const grow = (turn: ForeignTurn, id: string, seq: number, text: string) => {
		const held = turn.held.get(id)
		if (held && text.length > 0) {
			open(turn, held)
		}
		stream(turn, id, seq, text)
	}

	const complete = (turn: ForeignTurn, message: ChatMessage) => {
		const completion = ENDING_FOR[message.completion]
		if (!completion) {
			return
		}
		turn.held.delete(message.id)
		if (!turn.streamed.has(message.id)) {
			if (!isWorthKeeping(message, completion)) {
				return
			}
			open(turn, message)
		}
		settle(turn, message.id, completion)
	}

	const end = (turn: ForeignTurn, completion: TerminalCompletion) => {
		for (const held of [...turn.held.values()]) {
			if (isWorthKeeping(held, completion)) {
				open(turn, held)
			}
		}
		for (const id of [...turn.streamed.keys()]) {
			settle(turn, id, completion)
		}
		turns.delete(keyOf(turn.scope))
	}

	const apply = (turn: ForeignTurn, event: AgentEvent) => {
		switch (event.type) {
			case "messageStarted":
				return start(turn, event.message)
			case "messageDelta":
				return grow(turn, event.id, event.seq, event.text)
			case "messageCompleted":
				return complete(turn, event.message)
			case "turnChanged":
				return noteTurnState(turn, event.state)
			case "activity":
				return noteActivity(turn, event.activity)
			case "turnEnded":
				return end(turn, ENDING_FOR_OUTCOME[event.ended.outcome])
			case "failed":
				return closeSpeaker(turn)
			default:
				return
		}
	}

	return {
		claim: (scope) => {
			claimed.add(keyOf(scope))
			turns.delete(keyOf(scope))
		},
		render: (scope, event) => {
			if (!claimed.has(keyOf(scope))) {
				apply(turnAt(scope), event)
			}
		},
		speakersIn: (conversationId) =>
			[...turns.values()].flatMap(({ scope, speaker }) =>
				speaker && scope.conversationId === conversationId ? speaker : [],
			),
	}
}
