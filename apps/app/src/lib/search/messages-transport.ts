import { invoke } from "@tauri-apps/api/core"

import type { MessageHit, MessageSearchQuery } from "./search-contract"

export const messagesTransport = {
	search: (query: MessageSearchQuery) =>
		invoke<MessageHit[]>("search_messages", { query }),
}
