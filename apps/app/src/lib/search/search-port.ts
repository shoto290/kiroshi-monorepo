import type { Catalogue, CatalogueChat } from "./catalogue-contract"
import type { CatalogueScope } from "./catalogue-transport"
import { catalogueTransport } from "./catalogue-transport"
import { messagesTransport } from "./messages-transport"
import type { MessageHit, MessageSearchQuery } from "./search-contract"

export type SearchPort = {
	messages: (query: MessageSearchQuery) => Promise<MessageHit[]>
	catalogue: (scope: CatalogueScope) => Promise<Catalogue>
	recent: (spaceId: string) => Promise<CatalogueChat[]>
}

export const searchPort: SearchPort = {
	messages: messagesTransport.search,
	catalogue: catalogueTransport.search,
	recent: catalogueTransport.recent,
}
