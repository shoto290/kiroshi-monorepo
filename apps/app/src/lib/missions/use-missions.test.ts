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

	describe("when changes arrive in a burst", () => {
		const A_CHANGE: MissionChanged = {
			missionId: "m-1",
			state: "working",
			stateSeq: 2,
			isAgentRunning: true,
			lastActivityAt: 42,
		}
		let announce: (changed: MissionChanged) => void = () => undefined

		const mountSettled = async () => {
			const mounted = renderHook(() => useMissions("c-1"))
			await act(async () => undefined)
			listMissions.mockClear()
			return mounted
		}

		beforeEach(() => {
			vi.useFakeTimers()
			listenToMissions.mockImplementation((listener) => {
				announce = listener
				return Promise.resolve(() => undefined)
			})
		})

		it("lists the missions at most once a second while the burst lasts", async () => {
			await mountSettled()
			listMissions.mockClear()
			const readAt: number[] = []
			listMissions.mockImplementation(() => {
				readAt.push(Date.now())
				return new Promise(() => undefined)
			})

			for (let elapsed = 0; elapsed < 3000; elapsed += 100) {
				act(() => announce(A_CHANGE))
				act(() => vi.advanceTimersByTime(100))
			}

			const gaps = readAt.slice(1).map((at, i) => at - readAt[i])
			expect(readAt.length).toBeGreaterThan(1)
			expect(gaps.every((gap) => gap >= 1000)).toBe(true)
		})

		it("lists the missions once after the burst ends", async () => {
			await mountSettled()
			for (let change = 0; change < 5; change += 1) {
				act(() => announce(A_CHANGE))
			}

			act(() => vi.advanceTimersByTime(5000))

			expect(listMissions).toHaveBeenCalledTimes(2)
		})

		it("drops the pending list when it unmounts", async () => {
			const { unmount } = await mountSettled()
			act(() => announce(A_CHANGE))
			act(() => announce(A_CHANGE))

			unmount()
			act(() => vi.advanceTimersByTime(5000))

			expect(listMissions).toHaveBeenCalledTimes(1)
		})
	})
})
