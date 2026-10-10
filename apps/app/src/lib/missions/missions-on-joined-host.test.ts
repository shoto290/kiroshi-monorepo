// @vitest-environment happy-dom

import type { EventCallback } from "@tauri-apps/api/event"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Mission, MissionInSpace } from "./mission-contract"
import { missionsTransport } from "./missions-transport"
import { useMissionMarks } from "./use-mission-marks"
import { useMissions } from "./use-missions"
import { useSpaceMissions } from "./use-space-missions"

import {
	JOINED_SPACE_RECONNECTED_EVENT,
	type JoinedSpaceReconnected,
} from "../bindings"
import type { HostSocket } from "../host/http"
import { createJoinedHosts, type JoinedHosts } from "../host/joined-hosts"

const HOST = "http://192.168.1.20:45367"

type Answer = (command: string) => Promise<unknown>

const wire = vi.hoisted(() => ({
	localAnswer: (async (command) =>
		command === "conversation_local_ids" ? [] : null) as Answer,
	hostAnswer: (async () => null) as Answer,
	sockets: [] as HostSocket[],
	relays: new Set<EventCallback<JoinedSpaceReconnected>>(),
	hostReads: [] as string[],
	joinedHosts: null as JoinedHosts | null,
}))

vi.mock("../host", () => {
	const joinedHosts = new Proxy({} as JoinedHosts, {
		get: (_, key) => {
			if (!wire.joinedHosts) {
				throw new Error("no joined-hosts router built for this test")
			}
			return Reflect.get(wire.joinedHosts, key)
		},
	})
	return {
		joinedHosts,
		activeJoinedSpaceId: () => joinedHosts.activeSpaceId(),
		invoke: ((...args: Parameters<JoinedHosts["invoke"]>) =>
			joinedHosts.invoke(...args)) as JoinedHosts["invoke"],
		listen: ((...args: Parameters<JoinedHosts["listen"]>) =>
			joinedHosts.listen(...args)) as JoinedHosts["listen"],
	}
})

const buildJoinedHosts = (): JoinedHosts =>
	createJoinedHosts({
		local: {
			invoke: ((command: string) => wire.localAnswer(command)) as never,
			listen: async (event, handler) => {
				if (event === JOINED_SPACE_RECONNECTED_EVENT) {
					wire.relays.add(handler as EventCallback<JoinedSpaceReconnected>)
				}
				return () => undefined
			},
			fileSrc: (path) => path,
		},
		join: async (id) => ({
			status: "ok",
			data: {
				id,
				hostUrl: HOST,
				token: "joined",
				remoteSpaceId: null,
				name: id,
			},
		}),
		fetch: async (input) => {
			const command = decodeURIComponent(String(input).split("/").pop() ?? "")
			wire.hostReads.push(command)
			return new Response(JSON.stringify(await wire.hostAnswer(command)), {
				headers: { "content-type": "application/json" },
			})
		},
		openSocket: () => {
			const socket: HostSocket = {
				onopen: null,
				onmessage: null,
				onclose: null,
				close: () => undefined,
			}
			wire.sockets.push(socket)
			return socket
		},
		reportFailure: () => undefined,
		reportHostDown: () => "notice",
		endHostDown: () => undefined,
	})

const { joinedHosts } = await import("../host")

const missionOf = (id: string, objective: string): Mission => ({
	id,
	originConversationId: "c-1",
	botId: "bot-on-host",
	threadConversationId: `c-${id}`,
	objective,
	ticket: {
		platform: "linear",
		externalId: "OPE-42",
		url: "https://linear.app/ope-42",
		title: "Changelog parser",
	},
	tools: [],
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
	branch: null,
	workspacePath: null,
})

const HOST_MISSION = missionOf("m-host", "Rewrite the changelog parser")
const LOCAL_MISSION = missionOf("m-local", "A mission of the guest's own")

const deferred = <T>() => {
	let resolve: (value: T) => void = () => undefined
	const promise = new Promise<T>((settle) => {
		resolve = settle
	})
	return { promise, resolve }
}

const answering =
	(answers: Record<string, unknown>): Answer =>
	async (command) =>
		answers[command] ?? null

const hostAnswers = answering({
	mission_list: { open: [HOST_MISSION], done: [] },
	mission_space_feed: [
		{
			mission: HOST_MISSION,
			conversationId: "c-1",
			conversationTitle: "Parser",
		},
	] satisfies MissionInSpace[],
})

const objectivesOf = (missions: Mission[]) =>
	missions.map(({ objective }) => objective)

const lastSocket = () => wire.sockets[wire.sockets.length - 1]

const openLastSocket = () =>
	act(() => {
		const socket = lastSocket()
		socket?.onopen?.call(socket as WebSocket, new Event("open"))
	})

const reopenRelay = (id: string) =>
	act(async () => {
		for (const relay of wire.relays) {
			relay({ event: JOINED_SPACE_RECONNECTED_EVENT, id: 0, payload: { id } })
		}
	})

const readsOf = (command: string) =>
	wire.hostReads.filter((read) => read === command).length

const settled = () =>
	act(async () => {
		for (let round = 0; round < 20; round += 1) {
			await Promise.resolve()
		}
	})

const dropLastSocket = () => {
	vi.useFakeTimers()
	act(() => {
		const socket = lastSocket()
		socket?.onclose?.call(socket as WebSocket, new Event("close") as CloseEvent)
	})
	vi.runOnlyPendingTimers()
	vi.useRealTimers()
}

const joinGarage = async () => {
	wire.localAnswer = answering({ mission_list: { open: [], done: [] } })
	await joinedHosts.activate("garage")
	await openLastSocket()
}

const activityPanelOnGarage = async () => {
	await joinGarage()
	const rendered = renderHook(() => useMissions("c-1"))
	await waitFor(() =>
		expect(objectivesOf(rendered.result.current.open)).toEqual([
			HOST_MISSION.objective,
		]),
	)
	return rendered
}

describe("missions read on a joined host", () => {
	beforeEach(() => {
		wire.joinedHosts = buildJoinedHosts()
		wire.sockets.length = 0
		wire.relays.clear()
		wire.hostReads.length = 0
		wire.hostAnswer = hostAnswers
	})

	afterEach(() => {
		cleanup()
		joinedHosts.forget("garage")
	})

	it("shows the host's missions once the host of the selected space becomes active", async () => {
		const localRead = deferred<unknown>()
		wire.localAnswer = async (command) =>
			command === "conversation_local_ids" ? [] : localRead.promise
		const { result } = renderHook(() => ({
			conversation: useMissions("c-1"),
			space: useSpaceMissions("space-on-host"),
		}))

		await act(() => joinedHosts.activate("garage"))
		await openLastSocket()
		await waitFor(() =>
			expect(objectivesOf(result.current.conversation.open)).toEqual([
				HOST_MISSION.objective,
			]),
		)
		await act(async () => {
			localRead.resolve([{ mission: LOCAL_MISSION, conversationId: "c-1" }])
		})

		expect(objectivesOf(result.current.conversation.missions)).toEqual([
			HOST_MISSION.objective,
		])
		expect(
			result.current.space.inProgress.map(({ mission }) => mission.objective),
		).toEqual([HOST_MISSION.objective])
	})

	it("reads the missions again when the active host reconnects", async () => {
		wire.localAnswer = answering({
			conversation_local_ids: [],
			mission_list: { open: [], done: [] },
		})
		await joinedHosts.activate("garage")
		await openLastSocket()
		const { result } = renderHook(() => useMissions("c-1"))
		await waitFor(() =>
			expect(objectivesOf(result.current.open)).toEqual([
				HOST_MISSION.objective,
			]),
		)

		dropLastSocket()
		const reopened = missionOf("m-reopened", "Ship the parser")
		wire.hostAnswer = answering({
			mission_list: { open: [reopened], done: [] },
		})
		await openLastSocket()

		await waitFor(() =>
			expect(objectivesOf(result.current.open)).toEqual([reopened.objective]),
		)
	})

	it("marks the host's open missions without asking the host for its board", async () => {
		const asked: string[] = []
		wire.hostAnswer = async (command) => {
			asked.push(command)
			return hostAnswers(command)
		}
		await joinedHosts.activate("garage")
		await openLastSocket()
		const { result } = renderHook(() => useMissionMarks("space-on-host"))

		await waitFor(() =>
			expect(
				objectivesOf(result.current.map(({ mission }) => mission)),
			).toEqual([HOST_MISSION.objective]),
		)
		expect(await missionsTransport.board()).toEqual([])
		expect(asked).not.toContain("mission_board")
	})

	it("drops the marks while the host is down and reads them again once it is back", async () => {
		await joinedHosts.activate("garage")
		await openLastSocket()
		const { result } = renderHook(() => useMissionMarks("space-on-host"))
		await waitFor(() => expect(result.current).toHaveLength(1))

		dropLastSocket()
		await waitFor(() => expect(result.current).toEqual([]))

		const reopened = missionOf("m-reopened", "Ship the parser")
		wire.hostAnswer = answering({
			mission_space_feed: [
				{
					mission: reopened,
					conversationId: "c-1",
					conversationTitle: "Parser",
				},
			] satisfies MissionInSpace[],
		})
		await openLastSocket()

		await waitFor(() =>
			expect(result.current.map(({ mission }) => mission.objective)).toEqual([
				reopened.objective,
			]),
		)
	})

	it("reads the local board again and drops the host's marks when leaving for a local Space", async () => {
		wire.localAnswer = answering({
			conversation_local_ids: [],
			mission_board: [{ mission: LOCAL_MISSION }],
		})
		await joinedHosts.activate("garage")
		await openLastSocket()
		const { result, rerender } = renderHook(
			({ spaceId }) => useMissionMarks(spaceId),
			{ initialProps: { spaceId: "space-on-host" } },
		)
		await waitFor(() =>
			expect(result.current.map(({ mission }) => mission.id)).toEqual([
				HOST_MISSION.id,
			]),
		)

		await act(() => joinedHosts.activate(null))
		rerender({ spaceId: "local-space" })

		await waitFor(() =>
			expect(result.current.map(({ mission }) => mission.id)).toEqual([
				LOCAL_MISSION.id,
			]),
		)
	})

	const marksOnGarage = async () => {
		await joinGarage()
		const rendered = renderHook(() => useMissionMarks("space-on-host"))
		await waitFor(() =>
			expect(rendered.result.current.map(({ mission }) => mission.id)).toEqual([
				HOST_MISSION.id,
			]),
		)
		const reopened = missionOf("m-reopened", "Ship the parser")
		wire.hostAnswer = answering({
			mission_space_feed: [
				{
					mission: reopened,
					conversationId: "c-1",
					conversationTitle: "Parser",
				},
			] satisfies MissionInSpace[],
		})
		return { ...rendered, reopened }
	}

	const markIdsOf = (marks: { mission: Mission }[]) =>
		marks.map(({ mission }) => mission.id)

	it("reads the conversation-row marks again when the relay of the joined Space reopens", async () => {
		const { result, reopened } = await marksOnGarage()

		await reopenRelay("garage")

		await waitFor(() =>
			expect(markIdsOf(result.current)).toEqual([reopened.id]),
		)
	})

	it("reads no marks when the relay of another Space reopens", async () => {
		const { result } = await marksOnGarage()
		const before = readsOf("mission_space_feed")

		await reopenRelay("attic")
		await settled()

		expect(readsOf("mission_space_feed")).toBe(before)
		expect(markIdsOf(result.current)).toEqual([HOST_MISSION.id])
	})

	it.each([
		["socket", "relay"],
		["relay", "socket"],
	])(
		"reads the marks once when the %s reopens before the %s",
		async (first) => {
			const { result, reopened } = await marksOnGarage()
			const before = readsOf("mission_space_feed")

			dropLastSocket()
			if (first === "relay") {
				await reopenRelay("garage")
				await openLastSocket()
			} else {
				await openLastSocket()
				await reopenRelay("garage")
			}
			await settled()

			expect(readsOf("mission_space_feed")).toBe(before + 1)
			expect(markIdsOf(result.current)).toEqual([reopened.id])
		},
	)

	it("reads the Activity panel again when the relay of the joined Space reopens", async () => {
		const { result } = await activityPanelOnGarage()
		const reopened = missionOf("m-reopened", "Ship the parser")
		wire.hostAnswer = answering({
			mission_list: { open: [reopened], done: [] },
		})

		await reopenRelay("garage")

		await waitFor(() =>
			expect(objectivesOf(result.current.open)).toEqual([reopened.objective]),
		)
	})

	it("reads the Missions tab again when the relay of the joined Space reopens", async () => {
		await joinGarage()
		const { result } = renderHook(() => useSpaceMissions("space-on-host"))
		await waitFor(() => expect(result.current.inProgress).toHaveLength(1))
		const reopened = missionOf("m-reopened", "Ship the parser")
		wire.hostAnswer = answering({
			mission_space_feed: [{ mission: reopened, conversationId: "c-1" }],
		})

		await reopenRelay("garage")

		await waitFor(() =>
			expect(
				result.current.inProgress.map(({ mission }) => mission.objective),
			).toEqual([reopened.objective]),
		)
	})

	it("reads no mission again when the relay of another Space reopens", async () => {
		await activityPanelOnGarage()
		renderHook(() => useSpaceMissions("space-on-host"))
		await settled()
		const before = [readsOf("mission_list"), readsOf("mission_space_feed")]

		await reopenRelay("attic")
		await settled()

		expect([readsOf("mission_list"), readsOf("mission_space_feed")]).toEqual(
			before,
		)
	})

	it("reads the missions once when the socket and the relay reopen together", async () => {
		await activityPanelOnGarage()
		renderHook(() => useSpaceMissions("space-on-host"))
		await settled()
		const before = [readsOf("mission_list"), readsOf("mission_space_feed")]

		dropLastSocket()
		await openLastSocket()
		await reopenRelay("garage")
		await settled()

		expect([readsOf("mission_list"), readsOf("mission_space_feed")]).toEqual(
			before.map((count) => count + 1),
		)
	})

	it("reads no mission again once the panels are gone", async () => {
		const { unmount } = await activityPanelOnGarage()
		unmount()
		const before = readsOf("mission_list")

		await reopenRelay("garage")
		await settled()

		expect(readsOf("mission_list")).toBe(before)
	})
})
