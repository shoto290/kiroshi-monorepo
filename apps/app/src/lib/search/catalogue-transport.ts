import { invoke } from "@tauri-apps/api/core"

import type { Catalogue, CatalogueChat } from "./catalogue-contract"

export type CatalogueScope = {
	query: string
	spaceId: string
	allSpaces: boolean
}

export const catalogueTransport = {
	search: ({ query, spaceId, allSpaces }: CatalogueScope) =>
		invoke<Catalogue>("search_catalogue", { query, spaceId, allSpaces }),
	recent: (spaceId: string) =>
		invoke<CatalogueChat[]>("search_recent", { spaceId }),
}
