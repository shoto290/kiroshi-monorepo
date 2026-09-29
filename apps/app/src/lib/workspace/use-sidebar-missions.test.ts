// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BLANK_BOT_PERMISSIONS } from "@workspace/ui/components/bot-settings"
import type { MissionsPanelMission } from "@workspace/ui/components/missions-panel"
import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import { useSidebarMissions } from "./use-sidebar-missions"

import type { Bot } from "@/lib/conversations/store-contract"
import { createFakeThreadRuntimes } from "@/lib/missions/fake-thread-runtimes"
import type {
	MissionChanged,
	MissionInSpace,
	MissionState,
} from "@/lib/missions/mission-contract"
import { aMission } from "@/lib/missions/mission-fixtures"
import { missionsTransport } from "@/lib/missions/missions-transport"

vi.mock("@/lib/missions/missions-transport", () => ({
	missionsTransport: {
		spaceFeed: vi.fn(),
		onChanged: vi.fn(),
	},
}))

vi.mock("@workspace/ui/components/notice-surface", () => ({
	raiseFailureNotice: vi.fn(),
}))

const readSpaceFeed = vi.mocked(missionsTransport.spaceFeed)
const listenToMissions = vi.mocked(missionsTransport.onChanged)
const notice = vi.mocked(raiseFailureNotice)

const BOT: Bot = {
	id: "bot-1",
	name: "Atlas",
	title: "",
	model: "sonnet",
	avatarAnimal: "owl",
	avatarBlot: "blue",
	avatarImagePath: null,
	instructions: "",
	deniedTools: [],
	permissions: BLANK_BOT_PERMISSIONS,
	outputStyle: "",
	createdAt: 1,
	changesNothing: false,
	memory: "",
	sectionId: null,
	pinPosition: null,
}

const NOW = Date.now()

type EntrySeed = {
	id: string
	state: MissionState
	conversationId: string
}

const anEntry = ({ id, state, conversationId }: EntrySeed): MissionInSpace => ({
	mission: aMission({
		id,
		botId: BOT.id,
		state,
		stateSeq: 1,
		openedAt: NOW - 1000,
		lastActivityAt: null,
		closedAt: state === "done" ? NOW : null,
	}),
	conversationId,
	conversationTitle: conversationId,
})

const WAITING = anEntry({
	id: "m-waiting",
	state: "waiting_human",
	conversationId: "c-1",
})
const WORKING = anEntry({
	id: "m-working",
	state: "working",
	conversationId: "c-2",
})
const DONE = anEntry({ id: "m-done", state: "done", conversationId: "c-1" })
const ELSEWHERE = anEntry({
	id: "m-elsewhere",
	state: "waiting_human",
	conversationId: "c-9",
})

const idsOf = (missions: MissionsPanelMission[]) =>
	missions.map(({ id, conversationId }) => ({ id, conversationId }))

const renderSidebarMissions = (spaceId: string | null = "s-1") => {
	const selectConversation = vi.fn()
	const open = vi.fn()
	const { runtimes } = createFakeThreadRuntimes()
	const rendered = renderHook(
		({ selectedSpaceId }) =>
			useSidebarMissions({
				core: {
					conversationRuntimes: runtimes,
					openedMission: { open },
					roster: {
						state: { rosters: { "s-1": [BOT], "s-2": [BOT] } },
						controller: { selectConversation },
					},
					spaces: { state: { selectedSpaceId } },
				},
				rosterLines: { now: NOW },
			}),
		{ initialProps: { selectedSpaceId: spaceId } },
	)
	return { ...rendered, selectConversation, open }
}

describe("useSidebarMissions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readSpaceFeed.mockResolvedValue([WAITING, WORKING, DONE])
		listenToMissions.mockResolvedValue(() => undefined)
	})

	afterEach(cleanup)

	it("feeds waiting and in progress missions as open, closed ones as earlier today", async () => {
		const { result } = renderSidebarMissions()

		await waitFor(() => expect(result.current.panel.open).toHaveLength(2))
		expect(idsOf(result.current.panel.open)).toEqual([
			{ id: "m-waiting", conversationId: "c-1" },
			{ id: "m-working", conversationId: "c-2" },
		])
		expect(idsOf(result.current.panel.earlierToday)).toEqual([
			{ id: "m-done", conversationId: "c-1" },
		])
	})

	it("counts the missions of the space waiting on the reader", async () => {
		const { result } = renderSidebarMissions()

		await waitFor(() => expect(result.current.waitingCount).toBe(1))
	})

	it("counts nothing when no mission waits on the reader", async () => {
		readSpaceFeed.mockResolvedValue([WORKING, DONE])
		const { result } = renderSidebarMissions()

		await waitFor(() => expect(result.current.panel.open).toHaveLength(1))
		expect(result.current.waitingCount).toBe(0)
	})

	it("moves a mission out of waiting when its state changes, without a reload", async () => {
		let announce: (changed: MissionChanged) => void = () => undefined
		listenToMissions.mockImplementation((listener) => {
			announce = listener
			return Promise.resolve(() => undefined)
		})
		const { result } = renderSidebarMissions()
		await waitFor(() => expect(result.current.waitingCount).toBe(1))
		await waitFor(() => expect(listenToMissions).toHaveBeenCalled())
		readSpaceFeed.mockReturnValue(new Promise(() => undefined))

		act(() => {
			announce({
				missionId: "m-waiting",
				state: "done",
				stateSeq: 2,
				isAgentRunning: false,
				lastActivityAt: NOW,
			})
		})

		expect(result.current.waitingCount).toBe(0)
		expect(result.current.panel.open.map(({ id }) => id)).toEqual(["m-working"])
		expect(result.current.panel.earlierToday.map(({ id }) => id)).toContain(
			"m-waiting",
		)
	})

	it("shows only the missions of the newly selected space", async () => {
		const { result, rerender } = renderSidebarMissions()
		await waitFor(() => expect(result.current.panel.open).toHaveLength(2))
		readSpaceFeed.mockResolvedValue([ELSEWHERE])

		rerender({ selectedSpaceId: "s-2" })

		expect(result.current.panel.open).toEqual([])
		await waitFor(() =>
			expect(idsOf(result.current.panel.open)).toEqual([
				{ id: "m-elsewhere", conversationId: "c-9" },
			]),
		)
		expect(result.current.panel.earlierToday).toEqual([])
		expect(readSpaceFeed).toHaveBeenLastCalledWith("s-2", expect.any(Number))
	})

	it("selects the mission conversation, then opens the mission thread", async () => {
		const { result, selectConversation, open } = renderSidebarMissions()
		await waitFor(() => expect(result.current.panel.open).toHaveLength(2))

		result.current.panel.onOpen("m-working", "c-2")

		expect(selectConversation).toHaveBeenCalledWith("c-2")
		expect(open).toHaveBeenCalledWith({ missionId: "m-working", rowId: "c-2" })
		expect(selectConversation.mock.invocationCallOrder[0]).toBeLessThan(
			open.mock.invocationCallOrder[0],
		)
	})

	it("raises one failure notice when the feed fails, whose retry reads again", async () => {
		readSpaceFeed.mockRejectedValue(new Error("offline"))
		const { rerender } = renderSidebarMissions()

		await waitFor(() => expect(notice).toHaveBeenCalledTimes(1))
		expect(notice.mock.calls[0][0]).toMatchObject({
			title: "Couldn’t load missions",
			action: { label: "Retry" },
		})
		rerender({ selectedSpaceId: "s-1" })
		expect(notice).toHaveBeenCalledTimes(1)

		const reads = readSpaceFeed.mock.calls.length
		readSpaceFeed.mockResolvedValue([WAITING])
		act(() => notice.mock.calls[0][0].action?.onPress())

		await waitFor(() => expect(readSpaceFeed.mock.calls.length).toBe(reads + 1))
	})
})
