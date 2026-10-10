// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"

import type { MissionChanged, MissionInSpace } from "./mission-contract"
import { aMission } from "./mission-fixtures"
import { missionsTransport } from "./missions-transport"
import { useSpaceMissionMarks } from "./use-space-mission-marks"

import { hostOfflineOf } from "@/lib/host/host-offline"

const reachable = vi.hoisted(() => ({ host: "local" as string | null }))

vi.mock("@/lib/host/use-reachable-host", () => ({
	useReachableHost: () => reachable.host,
}))

vi.mock("@workspace/ui/components/notice-surface", () => ({
	raiseFailureNotice: vi.fn(),
}))

vi.mock("./missions-transport", () => ({
	missionsTransport: {
		spaceFeed: vi.fn(),
		onChanged: vi.fn(),
	},
}))

const readSpaceFeed = vi.mocked(missionsTransport.spaceFeed)
const listenToMissions = vi.mocked(missionsTransport.onChanged)

const inSpace = (id: string): MissionInSpace => ({
	mission: aMission({ id }),
	conversationId: "c-1",
	conversationTitle: "Crashes",
})

const LOCAL_MARKS = [inSpace("m-local")]
const JOINED_MARKS = [inSpace("m-joined")]

const A_CHANGE: MissionChanged = {
	missionId: "m-local",
	state: "closed",
	stateSeq: 2,
	isAgentRunning: false,
	lastActivityAt: null,
}

const idsOf = (entries: MissionInSpace[]) =>
	entries.map(({ mission }) => mission.id)

const answerBySpace = (spaceId: string) =>
	Promise.resolve(spaceId === "joined" ? JOINED_MARKS : LOCAL_MARKS)

const renderMarks = (spaceId: string | null) =>
	renderHook(({ shown }) => useSpaceMissionMarks(shown), {
		initialProps: { shown: spaceId },
	})

describe("useSpaceMissionMarks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		reachable.host = "local"
		readSpaceFeed.mockImplementation(answerBySpace)
		listenToMissions.mockResolvedValue(() => undefined)
	})

	afterEach(cleanup)

	it("reads only the open missions of the shown space", async () => {
		const before = Date.now()
		const { result } = renderMarks("local-space")

		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-local"]))
		const [spaceId, closedSince] = readSpaceFeed.mock.calls[0]
		expect(spaceId).toBe("local-space")
		expect(closedSince).toBeGreaterThanOrEqual(before)
	})

	it("reads nothing while no space is shown", () => {
		const { result } = renderMarks(null)

		expect(readSpaceFeed).not.toHaveBeenCalled()
		expect(result.current).toEqual([])
	})

	it("re-reads the marks when the shown space changes, and back", async () => {
		reachable.host = "garage"
		const { result, rerender } = renderMarks("joined")
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-joined"]))

		reachable.host = "local"
		rerender({ shown: "local-space" })
		expect(result.current).toEqual([])
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-local"]))

		reachable.host = "garage"
		rerender({ shown: "joined" })
		expect(result.current).toEqual([])
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-joined"]))
	})

	it("keeps the marks of a space it left from landing on the next one", async () => {
		let answerFirst: (entries: MissionInSpace[]) => void = () => undefined
		readSpaceFeed.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					answerFirst = resolve
				}),
		)
		const { result, rerender } = renderMarks("local-space")

		rerender({ shown: "joined" })
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-joined"]))
		await act(async () => answerFirst(LOCAL_MARKS))

		expect(idsOf(result.current)).toEqual(["m-joined"])
	})

	it("shows no marks while the host is unreachable and re-reads once it is back", async () => {
		reachable.host = "garage"
		const { result, rerender } = renderMarks("joined")
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-joined"]))

		reachable.host = null
		rerender({ shown: "joined" })

		expect(result.current).toEqual([])
		expect(readSpaceFeed).toHaveBeenCalledOnce()

		reachable.host = "garage"
		rerender({ shown: "joined" })

		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-joined"]))
		expect(readSpaceFeed).toHaveBeenCalledTimes(2)
		expect(raiseFailureNotice).not.toHaveBeenCalled()
	})

	it("drops the mark of a mission closed on the host once a change arrives", async () => {
		const { result } = renderMarks("local-space")
		await waitFor(() => expect(idsOf(result.current)).toEqual(["m-local"]))
		await waitFor(() => expect(listenToMissions).toHaveBeenCalled())

		readSpaceFeed.mockResolvedValue([])
		const [announce] = listenToMissions.mock.calls[0]
		act(() => announce(A_CHANGE))

		await waitFor(() => expect(result.current).toEqual([]), { timeout: 2000 })
	})

	it("stops listening for mission changes once unmounted", async () => {
		const stopListening = vi.fn()
		listenToMissions.mockResolvedValue(stopListening)
		const { unmount } = renderMarks("local-space")
		await waitFor(() => expect(listenToMissions).toHaveBeenCalled())

		unmount()

		await waitFor(() => expect(stopListening).toHaveBeenCalled())
	})

	it("raises one notice when the feed keeps failing on a reachable host", async () => {
		readSpaceFeed.mockRejectedValue(new Error("no feed"))
		const { result } = renderMarks("local-space")
		await waitFor(() => expect(raiseFailureNotice).toHaveBeenCalledOnce())
		await waitFor(() => expect(listenToMissions).toHaveBeenCalled())

		const [announce] = listenToMissions.mock.calls[0]
		act(() => announce(A_CHANGE))

		await waitFor(() => expect(readSpaceFeed).toHaveBeenCalledTimes(2), {
			timeout: 2000,
		})
		await Promise.resolve()
		expect(raiseFailureNotice).toHaveBeenCalledOnce()
		expect(result.current).toEqual([])
	})

	it("raises no notice when the host drops while the feed is read", async () => {
		readSpaceFeed.mockRejectedValue(hostOfflineOf("the host is offline"))

		const { result } = renderMarks("joined")

		await waitFor(() => expect(readSpaceFeed).toHaveBeenCalled())
		await Promise.resolve()
		expect(result.current).toEqual([])
		expect(raiseFailureNotice).not.toHaveBeenCalled()
	})
})
