import type { Catalogue, CatalogueChat } from "./catalogue-contract"
import type { CatalogueScope, RecentScope } from "./catalogue-transport"
import { catalogueTransport } from "./catalogue-transport"
import { messagesTransport } from "./messages-transport"
import type { MessageHit, MessageSearchQuery } from "./search-contract"

export type SearchPort = {
	messages: (query: MessageSearchQuery) => Promise<MessageHit[]>
	catalogue: (scope: CatalogueScope) => Promise<Catalogue>
	recent: (scope: RecentScope) => Promise<CatalogueChat[]>
}

export const searchPort: SearchPort = {
	messages: messagesTransport.search,
	catalogue: catalogueTransport.search,
	recent: catalogueTransport.recent,
}
