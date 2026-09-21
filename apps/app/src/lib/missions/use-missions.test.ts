// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Mission, MissionChanged } from "./mission-contract"
import { missionsTransport } from "./missions-transport"
import { useMissions } from "./use-missions"

vi.mock("./missions-transport", () => ({
	missionsTransport: {
		list: vi.fn(),
		onChanged: vi.fn(),
	},
}))

const listMissions = vi.mocked(missionsTransport.list)
const listenToMissions = vi.mocked(missionsTransport.onChanged)

const MISSION: Mission = {
	id: "m-1",
	originConversationId: "c-1",
	botId: "bot-1",
	threadConversationId: "c-mission-1",
	objective: "Rewrite the changelog parser",
	ticket: {
		platform: "linear",
		externalId: "OPE-42",
		url: "https://linear.app/ope-42",
		title: "Changelog parser",
	},
	tools: ["Read"],
	state: "working",
	stateSeq: 1,
	isAgentRunning: false,
	openedAt: 0,
	closedAt: null,
	reportedAt: null,
	reportedTurnId: null,
	status: null,
	lastActivityAt: null,
	lastActivity: null,
	commitsAhead: null,
	dirtyFiles: null,
	pullRequestUrl: null,
}

const A_MINUTE_MS = 60_000

describe("useMissions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		listMissions.mockResolvedValue({ open: [MISSION], done: [] })
		listenToMissions.mockResolvedValue(() => undefined)
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it("reads the missions of the conversation once they are listed", async () => {
		const { result } = renderHook(() => useMissions("c-1"))

		await waitFor(() => expect(result.current.missions).toEqual([MISSION]))
		expect(result.current.open).toHaveLength(1)
		expect(result.current.hasFailed).toBe(false)
	})

	it("holds its read still when the roster clock ticks", async () => {
		const { result } = renderHook(() => useMissions("c-1"))
		await waitFor(() => expect(result.current.missions).toEqual([MISSION]))
		const read = result.current

		vi.useFakeTimers()
		vi.setSystemTime(Date.now() + A_MINUTE_MS)
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"))
		})

		expect(result.current).toBe(read)
	})

	it("applies the activity of a change naming a held mission before the reread returns", async () => {
		let announce: (changed: MissionChanged) => void = () => undefined
		listenToMissions.mockImplementation((listener) => {
			announce = listener
			return Promise.resolve(() => undefined)
		})
		const { result } = renderHook(() => useMissions("c-1"))
		await waitFor(() => expect(result.current.missions).toEqual([MISSION]))
		listMissions.mockReturnValue(new Promise(() => undefined))

		act(() =>
			announce({
				missionId: "m-1",
				state: "working",
				stateSeq: 2,
				isAgentRunning: true,
				lastActivityAt: 42,
			}),
		)

		expect(result.current.open).toEqual([
			{ ...MISSION, isAgentRunning: true, lastActivityAt: 42 },
		])
	})

	it("holds its read when a change names a mission it does not hold", async () => {
		let announce: (changed: MissionChanged) => void = () => undefined
		listenToMissions.mockImplementation((listener) => {
			announce = listener
			return Promise.resolve(() => undefined)
		})
		const { result } = renderHook(() => useMissions("c-1"))
		await waitFor(() => expect(result.current.missions).toEqual([MISSION]))
		listMissions.mockReturnValue(new Promise(() => undefined))
		const read = result.current

		act(() =>
			announce({
				missionId: "m-2",
				state: "working",
				stateSeq: 2,
				isAgentRunning: true,
				lastActivityAt: 42,
			}),
		)

		expect(result.current).toBe(read)
	})
})
