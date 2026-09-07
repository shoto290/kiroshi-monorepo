// @vitest-environment happy-dom

import {
	act,
	cleanup,
	fireEvent,
	renderHook,
	waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import "@workspace/ui/lib/i18n"

import type {
	Catalogue,
	CatalogueChat,
	CatalogueMission,
	CatalogueRoutine,
} from "./catalogue-contract"
import { createSearchLookups } from "./search-model"
import type { SearchNavigation } from "./search-navigation"
import type { SearchPort } from "./search-port"
import { useSearch } from "./use-search"

import type {
	Bot,
	Conversation,
	Space,
} from "@/lib/conversations/store-contract"
import { botIdentity } from "@/lib/conversations/transcript-fixtures"

const PERSONAL = "personal"

const WORK = "work"

const SPACES: Space[] = [
	{ id: PERSONAL, name: "Personal", colour: null, position: 0, createdAt: 1 },
	{ id: WORK, name: "Work", colour: "blue", position: 1, createdAt: 1 },
]

const A_BOT: Bot = {
	...botIdentity({ name: "Basile", avatarAnimal: "owl", avatarBlot: null }),
	id: "b-work",
	createdAt: 1,
	changesNothing: false,
	memory: "",
	sectionId: null,
	pinPosition: null,
}

const A_ROOM: Conversation = {
	id: "c-work",
	spaceId: WORK,
	sectionId: null,
	pinPosition: null,
	title: "Roadmap of the other space",
	instructions: "",
	createdAt: 1,
	updatedAt: 1,
	participants: [
		{
			botId: A_BOT.id,
			role: "lead",
			joinedAt: 1,
			leftAt: null,
			name: A_BOT.name,
			avatarAnimal: A_BOT.avatarAnimal,
			avatarBlot: null,
			avatarImagePath: null,
			isDeleted: false,
		},
	],
}

const A_CHAT: CatalogueChat = {
	conversationId: A_ROOM.id,
	kind: "topic",
	title: A_ROOM.title,
	botId: null,
	participants: [A_BOT.name],
	spaceId: WORK,
}

const A_MISSION: CatalogueMission = {
	id: "m-1",
	threadConversationId: "c-mission",
	objective: "Roadmap the parser",
	ticketPlatform: "linear",
	ticketExternalId: "OPE-51",
	ticketTitle: "Parser",
	state: "working",
	botId: A_BOT.id,
	spaceId: WORK,
}

const A_ROUTINE: CatalogueRoutine = {
	id: "r-1",
	conversationId: A_ROOM.id,
	botId: A_BOT.id,
	title: "Roadmap digest",
	triggerSourceId: "schedule",
	isEnabled: true,
	expression: "0 9 * * *",
	spaceId: WORK,
}

const ANOTHER_ROUTINE: CatalogueRoutine = {
	...A_ROUTINE,
	id: "r-2",
	title: "Roadmap review",
}

const A_CATALOGUE: Catalogue = {
	chats: [A_CHAT],
	missions: [A_MISSION],
	routines: [A_ROUTINE],
}

const aPort = (catalogue: Catalogue = A_CATALOGUE): SearchPort => ({
	messages: vi.fn().mockResolvedValue([]),
	catalogue: vi.fn().mockResolvedValue(catalogue),
	recent: vi.fn().mockResolvedValue([]),
})

type TracedNavigation = {
	navigation: SearchNavigation
	trace: string[]
}

const aNavigation = (): TracedNavigation => {
	const trace: string[] = []

	return {
		trace,
		navigation: {
			selectBot: (botId) => trace.push(`bot:${botId}`),
			selectConversation: (id) => trace.push(`conversation:${id}`),
			selectSpace: (spaceId) => trace.push(`space:${spaceId}`),
			openMission: ({ missionId, rowId }) =>
				trace.push(`mission:${missionId}:${rowId}`),
			openRoutine: ({ routineId, conversationId }) =>
				trace.push(`routine:${routineId}:${conversationId}`),
			openActivityPanel: () => trace.push("activity"),
		},
	}
}

type Rendering = {
	navigation: SearchNavigation
	port: SearchPort
	canOpen?: boolean
}

const renderSearch = ({ navigation, port, canOpen = true }: Rendering) => {
	const lookups = createSearchLookups({
		rosters: { [WORK]: [A_BOT] },
		conversationRosters: { [WORK]: [A_ROOM] },
		spaces: SPACES,
		readerName: "You",
		now: 2,
	})

	return renderHook(() =>
		useSearch({
			spaceId: PERSONAL,
			spaceName: "Personal",
			lookups,
			navigation,
			port,
			canOpen,
		}),
	).result
}

const searchedOn = async (port: SearchPort, navigation: SearchNavigation) => {
	const result = renderSearch({ navigation, port })

	act(() => result.current.open())
	act(() => result.current.palette.onQueryChange("roadmap"))
	await waitFor(() =>
		expect(result.current.palette.results[1].results).toHaveLength(1),
	)

	return result
}

const press = (key: string, held: KeyboardEventInit = {}) => {
	fireEvent.keyDown(document.body, { key, ...held })
}

const pressOnControl = (key: string, held: KeyboardEventInit = {}) => {
	const control = document.createElement("button")
	document.body.append(control)
	fireEvent.keyDown(control, { key, ...held })
	control.remove()
}

afterEach(cleanup)

it("opens the palette on an empty query, the All tab and the current space", () => {
	const { navigation } = aNavigation()
	const result = renderSearch({ navigation, port: aPort() })

	act(() => press("k", { metaKey: true }))

	expect(result.current.isOpen).toBe(true)
	expect(result.current.palette).toMatchObject({
		query: "",
		tab: "all",
		isScopeAllSpaces: false,
	})
})

it("opens no palette on the chord while another dialog is open", () => {
	const { navigation } = aNavigation()
	const result = renderSearch({
		navigation,
		port: aPort(),
		canOpen: false,
	})

	act(() => press("k", { metaKey: true }))

	expect(result.current.isOpen).toBe(false)
})

it("opens the chat of another space on its rank chord", async () => {
	const { navigation, trace } = aNavigation()
	const result = await searchedOn(aPort(), navigation)

	act(() => press("1", { metaKey: true }))

	expect(trace).toEqual([`conversation:${A_ROOM.id}`, `space:${WORK}`])
	expect(result.current.isOpen).toBe(false)
})

it("opens the mission of another space on its rank chord", async () => {
	const { navigation, trace } = aNavigation()
	await searchedOn(aPort(), navigation)

	act(() => press("2", { metaKey: true }))

	expect(trace).toEqual([
		`bot:${A_BOT.id}`,
		`space:${WORK}`,
		`mission:${A_MISSION.id}:${A_BOT.id}`,
	])
})

it("opens the routine of another space on its rank chord", async () => {
	const { navigation, trace } = aNavigation()
	await searchedOn(aPort(), navigation)

	act(() => press("3", { metaKey: true }))

	expect(trace).toEqual([
		`conversation:${A_ROOM.id}`,
		`space:${WORK}`,
		"activity",
		`routine:${A_ROUTINE.id}:${A_ROOM.id}`,
	])
})

it("opens the active result on Enter and moves it with the arrows", async () => {
	const { navigation, trace } = aNavigation()
	const result = await searchedOn(aPort(), navigation)

	expect(result.current.palette.activeResultId).toBe(`chat-${A_ROOM.id}`)

	act(() => press("ArrowUp"))

	expect(result.current.palette.activeResultId).toBe(`routine-${A_ROUTINE.id}`)

	act(() => press("ArrowDown"))
	act(() => press("Enter"))

	expect(trace).toEqual([`conversation:${A_ROOM.id}`, `space:${WORK}`])
})

it("leaves Enter to a control that is neither the query input nor the body", async () => {
	const { navigation, trace } = aNavigation()
	const result = await searchedOn(aPort(), navigation)

	act(() => pressOnControl("Enter"))

	expect(trace).toEqual([])
	expect(result.current.isOpen).toBe(true)
})

it("opens the result of a rank chord whatever the focused control", async () => {
	const { navigation, trace } = aNavigation()
	await searchedOn(aPort(), navigation)

	act(() => pressOnControl("1", { metaKey: true }))

	expect(trace).toEqual([`conversation:${A_ROOM.id}`, `space:${WORK}`])
})

it("moves and opens the active result after the See all button changed the tab", async () => {
	const { navigation, trace } = aNavigation()
	const port = aPort({ ...A_CATALOGUE, routines: [A_ROUTINE, ANOTHER_ROUTINE] })
	const result = await searchedOn(port, navigation)

	act(() => result.current.palette.onTabChange("routines"))
	act(() => press("ArrowDown"))

	expect(result.current.palette.activeResultId).toBe(
		`routine-${ANOTHER_ROUTINE.id}`,
	)

	act(() => press("Enter"))

	expect(trace).toEqual([
		`conversation:${A_ROOM.id}`,
		`space:${WORK}`,
		"activity",
		`routine:${ANOTHER_ROUTINE.id}:${A_ROOM.id}`,
	])
})

it("leaves a key press that only ends a composition to the composition", async () => {
	const { navigation, trace } = aNavigation()
	const result = await searchedOn(aPort(), navigation)
	const active = result.current.palette.activeResultId

	act(() => press("Enter", { isComposing: true }))

	expect(trace).toEqual([])
	expect(result.current.isOpen).toBe(true)
	expect(result.current.palette.activeResultId).toBe(active)
})
