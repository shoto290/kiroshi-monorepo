// @vitest-environment happy-dom

import { invoke } from "@tauri-apps/api/core"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useSidebarPanelSwitch } from "./use-sidebar-panel-switch"

import { createStore } from "../store"
import type { Bot, Conversation } from "../conversations/store-contract"
import { createOpenedMissionController } from "../missions/opened-mission-controller"
import { createShownMemory } from "../sidebar/shown-memory"
import type { UserPreferences } from "../user/preferences-contract"
import { useUser } from "../user/use-user"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

const hostInvoke = vi.mocked(invoke)

const STORED: UserPreferences = {
	displayName: "",
	profilePicturePath: null,
	colorScheme: "system",
	language: null,
	notifyOnQuestion: true,
	notifyOnPermission: true,
	notifyOnFinishedTurn: true,
	notifyWithSound: true,
	sidebarWidth: null,
	sidebarTab: "conversations",
	activityPanelOpen: false,
	firstRunDone: true,
	lastSpaceId: null,
	lastBotIdBySpace: {},
}

type RosterSeed = {
	spaceId: string
	bots: string[]
	conversations: string[]
	selectedBotId?: string
	selectedConversationId?: string
}

const rosterStateOf = ({
	spaceId,
	bots,
	conversations,
	selectedBotId,
	selectedConversationId,
}: RosterSeed) => ({
	spaceId,
	bots: bots.map((id) => ({ id }) as Bot),
	conversations: conversations.map((id) => ({ id }) as Conversation),
	selectedBotId: selectedBotId ?? null,
	selectedConversationId: selectedConversationId ?? null,
})

const aRoster = (seed: RosterSeed) => {
	const store = createStore(rosterStateOf(seed))
	return {
		...store,
		select: (id: string) =>
			store.setState({
				...store.getState(),
				selectedBotId: id,
				selectedConversationId: null,
			}),
		selectConversation: (id: string) =>
			store.setState({
				...store.getState(),
				selectedBotId: null,
				selectedConversationId: id,
			}),
		enter: (next: RosterSeed) => store.setState(rosterStateOf(next)),
	}
}

const MISSION_ROW = "b-mission"

const mountSwitch = async (seed: RosterSeed) => {
	const roster = aRoster(seed)
	const openedMission = createOpenedMissionController(roster)
	const shownMemory = createShownMemory({ roster, openedMission })
	const showLastMission = vi.fn(() => {
		const spaceId = roster.getState().spaceId
		const missionId =
			shownMemory.lastMissionIn(spaceId) ?? `first-of-${spaceId}`
		openedMission.open({ missionId, rowId: MISSION_ROW })
		roster.select(MISSION_ROW)
	})
	const mounted = renderHook(() => {
		const user = useUser()
		const sidebarTab = useSidebarPanelSwitch({
			core: {
				openedMission,
				roster: { controller: roster },
				shownMemory,
				user,
			},
			sidebarMissions: { showLastMission },
		})
		return { user, sidebarTab }
	})
	await act(() => mounted.result.current.user.controller.load())
	roster.enter(seed)

	const switchTo = (panel: "conversations" | "missions") =>
		act(() => mounted.result.current.sidebarTab.openSidebarTab(panel))
	const selectedRow = () =>
		roster.getState().selectedBotId ?? roster.getState().selectedConversationId

	return {
		...mounted,
		roster,
		openedMission,
		shownMemory,
		showLastMission,
		switchTo,
		selectedRow,
	}
}

const S1: RosterSeed = {
	spaceId: "s-1",
	bots: ["b-1", MISSION_ROW],
	conversations: ["c-1"],
	selectedConversationId: "c-1",
}

beforeEach(() => {
	hostInvoke.mockReset()
	hostInvoke.mockImplementation((_, args) =>
		Promise.resolve(
			(args as { preferences?: UserPreferences } | undefined)?.preferences ??
				STORED,
		),
	)
})

afterEach(cleanup)

describe("switching the sidebar tab", () => {
	it("opens the Missions tab on the mission the missions list reopens", async () => {
		const shown = await mountSwitch(S1)

		shown.switchTo("missions")

		expect(shown.result.current.sidebarTab.openTab).toBe("missions")
		expect(shown.showLastMission).toHaveBeenCalledTimes(1)
		expect(shown.openedMission.getState()?.missionId).toBe("first-of-s-1")
	})

	it("closes the mission and shows the last conversation shown on returning to Conversations", async () => {
		const shown = await mountSwitch(S1)
		shown.switchTo("missions")

		shown.switchTo("conversations")

		expect(shown.result.current.sidebarTab.openTab).toBe("conversations")
		expect(shown.openedMission.getState()).toBeNull()
		expect(shown.selectedRow()).toBe("c-1")
	})

	it("reopens the last mission shown after a round trip through Conversations", async () => {
		const shown = await mountSwitch(S1)
		act(() => shown.openedMission.open({ missionId: "m-7", rowId: "c-1" }))
		shown.switchTo("missions")
		shown.switchTo("conversations")

		shown.switchTo("missions")

		expect(shown.openedMission.getState()?.missionId).toBe("m-7")
	})

	it("shows the first row when the last conversation shown is gone", async () => {
		const shown = await mountSwitch(S1)
		shown.switchTo("missions")
		act(() =>
			shown.roster.setState({ ...shown.roster.getState(), conversations: [] }),
		)

		shown.switchTo("conversations")

		expect(shown.selectedRow()).toBe("b-1")
	})

	it("shows no row and no mission when the space holds no conversation", async () => {
		const shown = await mountSwitch({
			spaceId: "s-1",
			bots: [],
			conversations: [],
		})
		act(() =>
			shown.openedMission.open({ missionId: "m-7", rowId: MISSION_ROW }),
		)

		shown.switchTo("conversations")

		expect(shown.openedMission.getState()).toBeNull()
		expect(shown.selectedRow()).toBeNull()
	})

	it("reads the memory of the space shown after a space change", async () => {
		const shown = await mountSwitch(S1)
		act(() =>
			shown.roster.enter({
				spaceId: "s-2",
				bots: ["b-3", "b-4"],
				conversations: [],
				selectedBotId: "b-3",
			}),
		)
		act(() => shown.roster.select("b-4"))
		shown.switchTo("missions")
		shown.switchTo("conversations")
		expect(shown.selectedRow()).toBe("b-4")

		act(() =>
			shown.roster.enter({
				...S1,
				selectedConversationId: undefined,
				selectedBotId: "b-1",
			}),
		)
		shown.switchTo("missions")
		shown.switchTo("conversations")

		expect(shown.selectedRow()).toBe("b-1")
		expect(shown.shownMemory.lastRowIn("s-2")).toBe("b-4")
	})

	it("keeps the tab and the selection when a thread card opens a mission", async () => {
		const shown = await mountSwitch(S1)

		act(() => shown.openedMission.open({ missionId: "m-7", rowId: "c-1" }))

		expect(shown.result.current.sidebarTab.openTab).toBe("conversations")
		expect(shown.selectedRow()).toBe("c-1")
		expect(shown.shownMemory.lastMissionIn("s-1")).toBe("m-7")
	})
})
