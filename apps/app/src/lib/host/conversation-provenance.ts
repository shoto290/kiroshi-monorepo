import type { InvokeArgs } from "@tauri-apps/api/core"

export type ConversationSource = string | null

type Fields = { [key: string]: unknown }

const SCOPING_ID_KEYS = ["conversationId", "excludedConversationId"]

const SCOPING_ENVELOPES = ["scope", "message", "turn", "draft"]

const CONVERSATION_ANSWERS: ReadonlySet<string> = new Set([
	"conversation_main_chat",
	"conversation_create",
	"conversation_list",
	"conversation_update",
	"conversation_add_participant",
	"conversation_remove_participant",
	"conversation_set_lead",
])

const isFields = (value: unknown): value is Fields =>
	typeof value === "object" &&
	value !== null &&
	Object.getPrototypeOf(value) === Object.prototype

const isText = (value: unknown): value is string => typeof value === "string"

const scopingIdsAt = (holder: unknown): string[] =>
	isFields(holder)
		? SCOPING_ID_KEYS.map((key) => holder[key]).filter(isText)
		: []

const conversationIdsOf = (args?: InvokeArgs): string[] =>
	isFields(args)
		? [args, ...SCOPING_ENVELOPES.map((envelope) => args[envelope])].flatMap(
				scopingIdsAt,
			)
		: []

const conversationIdsNamedIn = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.flatMap(conversationIdsNamedIn)
	}
	if (!isFields(value)) {
		return []
	}
	return Object.entries(value).flatMap(([key, inner]) =>
		key === "conversationId" && isText(inner)
			? [inner]
			: conversationIdsNamedIn(inner),
	)
}

const ownIdsOf = (answer: unknown): string[] =>
	[answer]
		.flat()
		.map((conversation) =>
			isFields(conversation) ? conversation.id : undefined,
		)
		.filter(isText)

const conversationIdsAnswered = (command: string, answer: unknown) => [
	...(CONVERSATION_ANSWERS.has(command) ? ownIdsOf(answer) : []),
	...conversationIdsNamedIn(answer),
]

const leaveRefusalToCaller = () => undefined

export const createConversationProvenance = () => {
	const sourcesById = new Map<string, Set<ConversationSource>>()

	const learn = (source: ConversationSource, ids: string[]) => {
		for (const id of ids) {
			const sources = sourcesById.get(id) ?? new Set()
			sources.add(source)
			sourcesById.set(id, sources)
		}
	}

	const sourcesNamedIn = (args?: InvokeArgs): Set<ConversationSource> =>
		new Set(
			conversationIdsOf(args).flatMap((id) => [...(sourcesById.get(id) ?? [])]),
		)

	const record = <T>(
		source: ConversationSource,
		command: string,
		answer: Promise<T>,
	): Promise<T> => {
		answer.then(
			(answered) => learn(source, conversationIdsAnswered(command, answered)),
			leaveRefusalToCaller,
		)
		return answer
	}

	return { sourcesNamedIn, record }
}
