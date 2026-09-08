import type { SearchTab } from "@workspace/ui/components/search-palette"

import type {
	Catalogue,
	CatalogueChat,
	CatalogueMission,
	CatalogueRoutine,
} from "./catalogue-contract"
import { MAX_QUERY_CHARS, type MessageHit } from "./search-contract"
import type { SearchPort } from "./search-port"

export const QUIET_MS = 150

export type SearchRead = {
	messages: MessageHit[]
	chats: CatalogueChat[]
	missions: CatalogueMission[]
	routines: CatalogueRoutine[]
}

export type SearchState = {
	isOpen: boolean
	spaceId: string | null
	query: string
	tab: SearchTab
	isAllSpaces: boolean
	isLoading: boolean
	hasFailed: boolean
	activeIndex: number
	read: SearchRead
	recents: CatalogueChat[]
}

export type SearchController = {
	getState: () => SearchState
	subscribe: (listener: () => void) => () => void
	open: (spaceId: string) => void
	close: () => void
	setQuery: (query: string) => void
	setTab: (tab: SearchTab) => void
	setScope: (isAllSpaces: boolean) => void
	moveActive: (by: number, count: number) => void
}

export type SearchWiring = {
	port: SearchPort
	onFailure: () => void
}

const NOTHING_READ: SearchRead = {
	messages: [],
	chats: [],
	missions: [],
	routines: [],
}

type ReadScope = {
	query: string
	spaceId: string
	allSpaces: boolean
}

const CLOSED: SearchState = {
	isOpen: false,
	spaceId: null,
	query: "",
	tab: "all",
	isAllSpaces: false,
	isLoading: false,
	hasFailed: false,
	activeIndex: 0,
	read: NOTHING_READ,
	recents: [],
}

const isOverLimit = (query: string) => [...query].length > MAX_QUERY_CHARS

const readOf = (messages: MessageHit[], catalogue: Catalogue): SearchRead => ({
	messages,
	chats: catalogue.chats,
	missions: catalogue.missions,
	routines: catalogue.routines,
})

const wrapped = (index: number, count: number) =>
	count === 0 ? 0 : (index + count) % count

export const createSearchController = ({
	port,
	onFailure,
}: SearchWiring): SearchController => {
	let state = CLOSED
	let quiet: ReturnType<typeof setTimeout> | undefined
	let reads = 0
	const listeners = new Set<() => void>()

	const publish = (next: Partial<SearchState>) => {
		state = { ...state, ...next }
		for (const listener of [...listeners]) {
			listener()
		}
	}

	const fail = () => {
		publish({ isLoading: false, hasFailed: true })
		onFailure()
	}

	const settle = (ticket: number, next: Partial<SearchState>) => {
		if (ticket === reads) {
			publish(next)
		}
	}

	const restAnswer = ({ spaceId, allSpaces }: ReadScope) =>
		Promise.all([
			port.recent({ spaceId, allSpaces }),
			port.catalogue({ query: "", spaceId, allSpaces }),
		]).then(([recents, catalogue]) => ({
			recents,
			read: readOf([], catalogue),
		}))

	const foundAnswer = ({ query, spaceId, allSpaces }: ReadScope) =>
		Promise.all([
			port.messages({ text: query, spaceId, allSpaces }),
			port.catalogue({ query, spaceId, allSpaces }),
		]).then(([messages, catalogue]) => ({ read: readOf(messages, catalogue) }))

	const answerOf = (scope: ReadScope): Promise<Partial<SearchState>> =>
		scope.query === "" ? restAnswer(scope) : foundAnswer(scope)

	const read = () => {
		const { query, spaceId, isAllSpaces } = state

		if (!spaceId || isOverLimit(query)) {
			publish({ isLoading: false })
			return
		}

		reads += 1
		const ticket = reads
		publish({ isLoading: true })

		void answerOf({ query, spaceId, allSpaces: isAllSpaces }).then(
			(landed) =>
				settle(ticket, {
					isLoading: false,
					hasFailed: false,
					activeIndex: 0,
					...landed,
				}),
			() => {
				if (ticket === reads) {
					fail()
				}
			},
		)
	}

	const scheduleRead = () => {
		clearTimeout(quiet)

		if (state.query === "") {
			publish({ read: NOTHING_READ })
			read()
			return
		}

		quiet = setTimeout(read, QUIET_MS)
	}

	return {
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: (spaceId) => {
			clearTimeout(quiet)
			publish({ ...CLOSED, isOpen: true, spaceId })
			read()
		},

		close: () => {
			clearTimeout(quiet)
			reads += 1
			publish(CLOSED)
		},

		setQuery: (query) => {
			publish({ query, activeIndex: 0 })
			scheduleRead()
		},

		setTab: (tab) => publish({ tab, activeIndex: 0 }),

		setScope: (isAllSpaces) => {
			clearTimeout(quiet)
			publish({ isAllSpaces, activeIndex: 0 })
			read()
		},

		moveActive: (by, count) =>
			publish({ activeIndex: wrapped(state.activeIndex + by, count) }),
	}
}
