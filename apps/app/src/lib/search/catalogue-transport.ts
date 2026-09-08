import { invoke } from "@tauri-apps/api/core"

import type { Catalogue, CatalogueChat } from "./catalogue-contract"

export type RecentScope = {
	spaceId: string
	allSpaces: boolean
}

export type CatalogueScope = RecentScope & {
	query: string
}

export const catalogueTransport = {
	search: ({ query, spaceId, allSpaces }: CatalogueScope) =>
		invoke<Catalogue>("search_catalogue", { query, spaceId, allSpaces }),
	recent: ({ spaceId, allSpaces }: RecentScope) =>
		invoke<CatalogueChat[]>("search_recent", { spaceId, allSpaces }),
}
