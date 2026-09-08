import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type {
	Catalogue,
	CatalogueChat,
	CatalogueMission,
} from "./catalogue-contract"
import { MAX_QUERY_CHARS, type MessageHit } from "./search-contract"
import { createSearchController, QUIET_MS } from "./search-controller"
import type { SearchPort } from "./search-port"

const A_CHAT: CatalogueChat = {
	conversationId: "c-1",
	kind: "main",
	title: "Amélie",
	botId: "b-1",
	participants: [],
	spaceId: "personal",
}

const hitOf = (messageId: string): MessageHit => ({
	messageId,
	seq: 1,
	conversationId: "c-1",
	conversationKind: "main",
	conversationTitle: "Chat",
	authorBotId: "b-1",
	createdAt: 1,
	spaceId: "personal",
	snippet: [{ text: messageId, matched: true }],
})

const A_MISSION: CatalogueMission = {
	id: "mi-1",
	threadConversationId: "c-1",
	objective: "Roadmap the parser",
	ticketPlatform: "linear",
	ticketExternalId: "OPE-51",
	ticketTitle: "Parser",
	state: "working",
	botId: "b-1",
	spaceId: "personal",
}

const catalogueOf = (chats: CatalogueChat[]): Catalogue => ({
	chats,
	missions: [],
	routines: [],
})

const CATALOGUE_WITH_MISSION: Catalogue = {
	...catalogueOf([]),
	missions: [A_MISSION],
}

type Deferred<Value> = {
	promise: Promise<Value>
	resolve: (value: Value) => void
	reject: (reason: unknown) => void
}

const deferred = <Value>(): Deferred<Value> => {
	let resolve: (value: Value) => void = () => undefined
	let reject: (reason: unknown) => void = () => undefined
	const promise = new Promise<Value>((settle, fail) => {
		resolve = settle
		reject = fail
	})
	return { promise, resolve, reject }
}

const aPort = () => {
	const messages = vi.fn<SearchPort["messages"]>()
	const catalogue = vi.fn<SearchPort["catalogue"]>()
	const recent = vi.fn<SearchPort["recent"]>()
	messages.mockResolvedValue([])
	catalogue.mockResolvedValue(catalogueOf([]))
	recent.mockResolvedValue([A_CHAT])
	return { messages, catalogue, recent }
}

const openedOn = (port: SearchPort, onFailure = vi.fn()) => {
	const controller = createSearchController({ port, onFailure })
	controller.open("personal")
	return { controller, onFailure }
}

const settle = () => vi.advanceTimersByTimeAsync(0)

const quiet = () => vi.advanceTimersByTimeAsync(QUIET_MS)

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

it("reads the recents and the catalogue of the space it opens on", async () => {
	const port = aPort()
	port.catalogue.mockResolvedValueOnce(catalogueOf([A_CHAT]))
	const { controller } = openedOn(port)
	await settle()

	expect(port.recent).toHaveBeenCalledWith({
		spaceId: "personal",
		allSpaces: false,
	})
	expect(port.catalogue).toHaveBeenCalledWith({
		query: "",
		spaceId: "personal",
		allSpaces: false,
	})
	expect(controller.getState().recents).toEqual([A_CHAT])
	expect(controller.getState().read.chats).toEqual([A_CHAT])
	expect(port.messages).not.toHaveBeenCalled()
})

it("reads only after the query goes quiet", async () => {
	const port = aPort()
	const { controller } = openedOn(port)
	await settle()
	port.catalogue.mockClear()

	controller.setQuery("p")
	controller.setQuery("pa")
	controller.setQuery("par")
	await vi.advanceTimersByTimeAsync(QUIET_MS - 1)

	expect(port.catalogue).not.toHaveBeenCalled()

	await vi.advanceTimersByTimeAsync(1)

	expect(port.catalogue).toHaveBeenCalledTimes(1)
	expect(port.catalogue).toHaveBeenCalledWith({
		query: "par",
		spaceId: "personal",
		allSpaces: false,
	})
})

it("drops the answer of every read but the last one issued", async () => {
	const port = aPort()
	const stale = deferred<MessageHit[]>()
	const last = deferred<MessageHit[]>()
	port.messages
		.mockReturnValueOnce(stale.promise)
		.mockReturnValueOnce(last.promise)
	const { controller } = openedOn(port)

	controller.setQuery("par")
	await quiet()
	controller.setQuery("parser")
	await quiet()

	last.resolve([hitOf("m-last")])
	await settle()
	stale.resolve([hitOf("m-stale")])
	await settle()

	expect(controller.getState().read.messages).toEqual([hitOf("m-last")])
	expect(controller.getState().isLoading).toBe(false)
})

it("keeps the results of the previous read while the next one is in flight", async () => {
	const port = aPort()
	port.messages.mockResolvedValueOnce([hitOf("m-1")])
	const { controller } = openedOn(port)

	controller.setQuery("par")
	await quiet()

	port.messages.mockReturnValueOnce(deferred<MessageHit[]>().promise)
	controller.setQuery("parser")
	await quiet()

	expect(controller.getState().isLoading).toBe(true)
	expect(controller.getState().read.messages).toEqual([hitOf("m-1")])
})

it("holds a failed read rather than presenting an empty result list", async () => {
	const port = aPort()
	port.messages.mockResolvedValueOnce([hitOf("m-1")])
	const { controller, onFailure } = openedOn(port)

	controller.setQuery("par")
	await quiet()

	port.messages.mockRejectedValueOnce({ kind: "storage" })
	controller.setQuery("parser")
	await quiet()
	await settle()

	expect(onFailure).toHaveBeenCalledTimes(1)
	expect(controller.getState().hasFailed).toBe(true)
	expect(controller.getState().isLoading).toBe(false)
	expect(controller.getState().read.messages).toEqual([hitOf("m-1")])
})

it("issues no read for a query over the limit", async () => {
	const port = aPort()
	const { controller } = openedOn(port)

	controller.setQuery("a".repeat(MAX_QUERY_CHARS + 1))
	await quiet()

	expect(port.messages).not.toHaveBeenCalled()
	expect(controller.getState().isLoading).toBe(false)
})

it("reads again on the new scope when the all spaces switch changes", async () => {
	const port = aPort()
	const { controller } = openedOn(port)

	controller.setQuery("par")
	await quiet()
	controller.setScope(true)
	await settle()

	expect(port.catalogue).toHaveBeenLastCalledWith({
		query: "par",
		spaceId: "personal",
		allSpaces: true,
	})
	expect(port.messages).toHaveBeenLastCalledWith({
		text: "par",
		spaceId: "personal",
		allSpaces: true,
	})
})

it("reads the recents and the catalogue again when the query goes empty", async () => {
	const port = aPort()
	port.messages.mockResolvedValueOnce([hitOf("m-1")])
	const { controller } = openedOn(port)
	await settle()

	controller.setQuery("par")
	await quiet()
	controller.setQuery("")
	await settle()

	expect(port.recent).toHaveBeenCalledTimes(2)
	expect(port.catalogue).toHaveBeenLastCalledWith({
		query: "",
		spaceId: "personal",
		allSpaces: false,
	})
	expect(controller.getState().read.messages).toEqual([])
	expect(controller.getState().recents).toEqual([A_CHAT])
})

it("drops the catalogue of the erased query until the rest read lands", async () => {
	const port = aPort()
	const { controller } = openedOn(port)
	await settle()

	port.catalogue.mockResolvedValueOnce(CATALOGUE_WITH_MISSION)
	controller.setQuery("par")
	await quiet()

	expect(controller.getState().read.missions).toEqual([A_MISSION])

	const resting = deferred<Catalogue>()
	port.catalogue.mockReturnValueOnce(resting.promise)
	controller.setQuery("")

	expect(controller.getState().read.missions).toEqual([])
	expect(controller.getState().recents).toEqual([A_CHAT])

	resting.resolve(CATALOGUE_WITH_MISSION)
	await settle()

	expect(controller.getState().read.missions).toEqual([A_MISSION])
})

it("reads the recents and the catalogue of the new scope while the query is empty", async () => {
	const port = aPort()
	const { controller } = openedOn(port)
	await settle()

	controller.setScope(true)
	await settle()

	expect(port.recent).toHaveBeenLastCalledWith({
		spaceId: "personal",
		allSpaces: true,
	})
	expect(port.catalogue).toHaveBeenLastCalledWith({
		query: "",
		spaceId: "personal",
		allSpaces: true,
	})
})

it("keeps the resting rows on screen when a rest read fails", async () => {
	const port = aPort()
	const { controller, onFailure } = openedOn(port)
	await settle()

	port.recent.mockRejectedValueOnce({ kind: "storage" })
	controller.setScope(true)
	await settle()

	expect(onFailure).toHaveBeenCalledTimes(1)
	expect(controller.getState().hasFailed).toBe(true)
	expect(controller.getState().isLoading).toBe(false)
	expect(controller.getState().recents).toEqual([A_CHAT])
})

it("drops the answer of a rest read that a close has superseded", async () => {
	const port = aPort()
	const late = deferred<CatalogueChat[]>()
	port.recent.mockReturnValueOnce(late.promise)
	const { controller } = openedOn(port)

	controller.close()
	late.resolve([A_CHAT])
	await settle()

	expect(controller.getState().recents).toEqual([])
})

it("forgets its query, its tab, its scope and its active result when it closes", async () => {
	const port = aPort()
	const { controller } = openedOn(port)

	controller.setQuery("par")
	controller.setTab("missions")
	controller.setScope(true)
	controller.moveActive(1, 3)
	await quiet()
	controller.close()

	expect(controller.getState()).toMatchObject({
		isOpen: false,
		query: "",
		tab: "all",
		isAllSpaces: false,
		activeIndex: 0,
	})
})

it("wraps the active result at both ends of the visible order", () => {
	const port = aPort()
	const { controller } = openedOn(port)

	controller.moveActive(-1, 3)
	expect(controller.getState().activeIndex).toBe(2)

	controller.moveActive(1, 3)
	expect(controller.getState().activeIndex).toBe(0)
})
