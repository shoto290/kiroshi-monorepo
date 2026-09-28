import type { MessageHit, MessageSearchQuery } from "./search-contract"

import { invoke } from "../host"

export const messagesTransport = {
	search: (query: MessageSearchQuery) =>
		invoke<MessageHit[]>("search_messages", { query }),
}
