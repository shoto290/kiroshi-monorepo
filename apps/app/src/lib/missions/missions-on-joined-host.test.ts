// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Mission, MissionInSpace } from "./mission-contract"
import { useMissions } from "./use-missions"
import { useSpaceMissions } from "./use-space-missions"

import type { HostSocket } from "../host/http"

const HOST = "http://192.168.1.20:45367"

type Answer = (command: string) => Promise<unknown>

const wire = vi.hoisted(() => ({
	localAnswer: (async () => null) as Answer,
	hostAnswer: (async () => null) as Answer,
	sockets: [] as HostSocket[],
}))

vi.mock("../host", async () => {
	const { createJoinedHosts } = await import("../host/joined-hosts")
	const joinedHosts = createJoinedHosts({
		local: {
			invoke: ((command: string) => wire.localAnswer(command)) as never,
			listen: async () => () => undefined,
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
	return {
		joinedHosts,
		invoke: joinedHosts.invoke,
		listen: joinedHosts.listen,
	}
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

const dropLastSocket = () => {
	vi.useFakeTimers()
	act(() => {
		const socket = lastSocket()
		socket?.onclose?.call(socket as WebSocket, new Event("close") as CloseEvent)
	})
	vi.runOnlyPendingTimers()
	vi.useRealTimers()
}

describe("missions read on a joined host", () => {
	beforeEach(async () => {
		await joinedHosts.activate(null)
		wire.sockets.length = 0
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
		wire.localAnswer = answering({ mission_list: { open: [], done: [] } })
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
})
