// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createConversationController } from "./conversation-controller"
import { withFakeHostWrites } from "./fake-host-writes"
import { createFakeTranscriptStore } from "./fake-transcript-store"
import { createScriptedDriver } from "./scripted-driver"
import type { TranscriptStore } from "./store-port"
import type { TranscriptMessage } from "./transcript-contract"
import { seatBots } from "./transcript-fixtures"

import type { AgentEvent, RuntimeScope } from "../agent/contract"
import { agentTransport } from "../agent/transport"
import { useRosterReloads } from "../bots/use-roster-reloads"
import { createChatController } from "../chat/chat-controller"
import type { HostSocket } from "../host/http"

type Handler = (event: { event: string; id: number; payload: unknown }) => void

const wire = vi.hoisted(() => ({
	sockets: [] as HostSocket[],
	local: new Map<string, Set<Handler>>(),
}))

vi.mock("../host", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../host")>()
	const { createJoinedHosts } = await import("../host/joined-hosts")
	const joinedHosts = createJoinedHosts({
		local: {
			invoke: (async () => null) as never,
			listen: async (event, handler) => {
				const heard = wire.local.get(event) ?? new Set<Handler>()
				heard.add(handler as Handler)
				wire.local.set(event, heard)
				return () => {
					heard.delete(handler as Handler)
				}
			},
			fileSrc: (path) => path,
		},
		join: async (id) => ({
			status: "ok",
			data: {
				id,
				hostUrl: "http://192.168.1.20:45367",
				token: "joined",
				remoteSpaceId: null,
				name: id,
			},
		}),
		fetch: async () =>
			new Response("null", {
				headers: { "content-type": "application/json" },
			}),
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
		...actual,
		joinedHosts,
		invoke: joinedHosts.invoke,
		listen: joinedHosts.listen,
		listenToActiveHost: joinedHosts.listenToActiveHost,
		activeJoinedSpaceId: joinedHosts.activeSpaceId,
		onHostReconnected: joinedHosts.onReconnected,
		drivesRealHost: () => true,
	}
})

const { joinedHosts } = await import("../host")

const JOINED = "garage"

const BOT = "default"

const settled = () =>
	act(async () => {
		for (let round = 0; round < 20; round += 1) {
			await Promise.resolve()
		}
	})

const emitLocally = (event: string, payload: unknown) =>
	act(async () => {
		for (const handler of [...(wire.local.get(event) ?? [])]) {
			handler({ event, id: 0, payload })
		}
	})

const lastSocket = () => wire.sockets[wire.sockets.length - 1]

const emitOnHost = (event: string, payload: unknown) =>
	act(async () => {
		const socket = lastSocket()
		socket?.onmessage?.call(
			socket as WebSocket,
			new MessageEvent("message", { data: JSON.stringify({ event, payload }) }),
		)
	})

const openLastSocket = () =>
	act(async () => {
		const socket = lastSocket()
		socket?.onopen?.call(socket as WebSocket, new Event("open"))
	})

const dropLastSocket = () => {
	vi.useFakeTimers()
	const socket = lastSocket()
	socket?.onclose?.call(socket as WebSocket, new Event("close") as CloseEvent)
	vi.runOnlyPendingTimers()
	vi.useRealTimers()
}

const joinHost = async () => {
	await act(() => joinedHosts.activate(JOINED))
	await openLastSocket()
}

const reconnectHost = async () => {
	dropLastSocket()
	await openLastSocket()
	await settled()
}

const foreignScope = (conversationId: string): RuntimeScope => ({
	conversationId,
	botId: BOT,
	runtimeSessionId: "run-of-another-window",
	epoch: 1,
})

const streamed = (id: string, text: string): AgentEvent[] => [
	{
		type: "messageStarted",
		message: {
			id,
			role: "assistant",
			text: "",
			completion: "streaming",
			timestamp: 1,
		},
	},
	{ type: "messageDelta", id, seq: 1, text },
]

const TURN_ENDED: AgentEvent = {
	type: "turnEnded",
	ended: { sessionId: null, outcome: "completed" },
}

const writtenElsewhere = async (
	store: TranscriptStore,
	conversationId: string,
	content: string,
): Promise<TranscriptMessage> => {
	const id = `written-${content}`
	await store.appendUserMessage({
		id,
		conversationId,
		turnId: `turn-${content}`,
		authorBotId: null,
		repliedToMessageId: null,
		content,
		createdAt: 5,
	})
	return {
		id,
		conversationId,
		turnId: `turn-${content}`,
		seq: 0,
		role: "user",
		content,
		completion: "complete",
		createdAt: 5,
		authorBotId: null,
		authorAccountId: null,
		authorName: null,
		repliedToMessageId: null,
		runtimeSessionId: null,
	}
}

type Shown = {
	messages: { role: string; content: string; completion: string }[]
}

const contentsOf = ({ messages }: Shown) =>
	messages.map(({ content }) => content)

const assistantRowsOf = ({ messages }: Shown) =>
	messages.filter(({ role }) => role === "assistant")

const liveDriver = (store: TranscriptStore) => {
	const scripted = createScriptedDriver()
	return {
		scripted,
		driver: withFakeHostWrites(
			{ ...scripted, subscribe: agentTransport.subscribe },
			store,
		),
	}
}

const openSoloChat = async () => {
	const store = createFakeTranscriptStore()
	const { scripted, driver } = liveDriver(store)
	const controller = createChatController(driver, store)
	const detach = controller.attach()
	await act(() => controller.open(BOT, null).then(() => undefined))
	await settled()
	const conversationId = controller.getState().conversationId ?? ""
	return { store, scripted, controller, detach, conversationId }
}

const openRoom = async () => {
	const store = createFakeTranscriptStore()
	const { scripted, driver } = liveDriver(store)
	const [bot] = await seatBots(store, "personal", ["Ada"])
	const conversation = await store.createConversation({
		spaceId: "personal",
		sectionId: null,
		title: "Walls",
		botIds: [bot?.id ?? ""],
	})
	const controller = createConversationController(driver, store)
	const detach = controller.attach()
	await act(() => controller.open(conversation))
	await settled()
	return {
		store,
		scripted,
		controller,
		detach,
		botId: bot?.id ?? "",
		conversationId: conversation.id,
	}
}

beforeEach(async () => {
	await joinedHosts.activate(null)
	wire.sockets.length = 0
})

afterEach(() => {
	cleanup()
	joinedHosts.forget(JOINED)
})

describe("a solo conversation fed by every writer", () => {
	it("renders live a turn another window started", async () => {
		const { controller, detach, conversationId } = await openSoloChat()
		const scope = foreignScope(conversationId)

		for (const event of streamed("elsewhere-1", "Hello from elsewhere")) {
			await emitLocally("agent://event", { scope, event })
		}

		expect(assistantRowsOf(controller.getState())).toMatchObject([
			{ content: "Hello from elsewhere", completion: "streaming" },
		])

		await emitLocally("agent://event", { scope, event: TURN_ENDED })

		expect(assistantRowsOf(controller.getState())).toMatchObject([
			{ content: "Hello from elsewhere", completion: "complete" },
		])
		detach()
	})

	it("reloads the page when a message is stored in the open conversation", async () => {
		const { store, controller, detach, conversationId } = await openSoloChat()
		const stored = await writtenElsewhere(store, conversationId, "From a guest")

		await emitLocally("conversation://message-stored", stored)
		await settled()

		expect(contentsOf(controller.getState())).toContain("From a guest")
		detach()
	})

	it("takes the events from the joined host and not from local Tauri while a joined space is active", async () => {
		const { store, controller, detach, conversationId } = await openSoloChat()
		await joinHost()
		const local = await writtenElsewhere(store, conversationId, "Local echo")

		await emitLocally("conversation://message-stored", local)
		await settled()

		expect(contentsOf(controller.getState())).not.toContain("Local echo")

		await emitOnHost("conversation://message-stored", local)
		await settled()

		expect(contentsOf(controller.getState())).toContain("Local echo")

		const scope = foreignScope(conversationId)
		for (const event of streamed("hosted-1", "Typed on the host")) {
			await emitOnHost("agent://event", { scope, event })
		}

		expect(contentsOf(controller.getState())).toContain("Typed on the host")
		detach()
	})

	it("reloads the transcript when the joined host comes back up", async () => {
		const { store, controller, detach, conversationId } = await openSoloChat()
		await joinHost()
		await writtenElsewhere(store, conversationId, "Missed while down")

		await reconnectHost()

		expect(contentsOf(controller.getState())).toContain("Missed while down")
		detach()
	})

	it("keeps a turn started in this window rendered once", async () => {
		const { scripted, controller, detach, conversationId } =
			await openSoloChat()
		await act(() => controller.send("Hi"))
		await settled()
		const scope = scripted.submissions.at(-1)?.scope

		for (const event of [...streamed("mine-1", "Mine"), TURN_ENDED]) {
			await emitLocally("agent://event", { scope, event })
		}
		await settled()
		const prompt = controller
			.getState()
			.messages.find(({ role }) => role === "user")
		await emitLocally("conversation://message-stored", {
			...prompt,
			conversationId,
		})
		await settled()

		expect(assistantRowsOf(controller.getState())).toMatchObject([
			{ content: "Mine" },
		])
		expect(
			contentsOf(controller.getState()).filter((text) => text === "Hi"),
		).toHaveLength(1)
		detach()
	})
})

describe("a room fed by every writer", () => {
	it("renders live a turn another window started", async () => {
		const { controller, detach, botId, conversationId } = await openRoom()
		const scope = { ...foreignScope(conversationId), botId }

		for (const event of [...streamed("elsewhere-2", "Room echo"), TURN_ENDED]) {
			await emitLocally("agent://event", { scope, event })
		}

		expect(assistantRowsOf(controller.getState())).toMatchObject([
			{ content: "Room echo", completion: "complete" },
		])
		detach()
	})

	it("reloads the page when a message is stored in the open room", async () => {
		const { store, controller, detach, conversationId } = await openRoom()
		const stored = await writtenElsewhere(store, conversationId, "Room guest")

		await emitLocally("conversation://message-stored", stored)
		await settled()

		expect(contentsOf(controller.getState())).toContain("Room guest")
		detach()
	})

	it("reloads the transcript when the joined host comes back up", async () => {
		const { store, controller, detach, conversationId } = await openRoom()
		await joinHost()
		await writtenElsewhere(store, conversationId, "Room missed")

		await reconnectHost()

		expect(contentsOf(controller.getState())).toContain("Room missed")
		detach()
	})

	it("keeps a turn started in this window rendered once", async () => {
		const { scripted, controller, detach, botId } = await openRoom()
		await act(() => controller.send("@Ada hi"))
		await settled()
		const scope = scripted.submissions.findLast(
			(submission) => submission.scope.botId === botId,
		)?.scope

		for (const event of [...streamed("mine-2", "Room mine"), TURN_ENDED]) {
			await emitLocally("agent://event", { scope, event })
		}
		await settled()

		expect(assistantRowsOf(controller.getState())).toMatchObject([
			{ content: "Room mine" },
		])
		detach()
	})
})

describe("the roster and the conversation list fed by every writer", () => {
	const CHANGES = [
		["conversation://created", { spaceId: "personal", conversation: {} }],
		["conversation://updated", { spaceId: "personal", conversation: {} }],
		["conversation://deleted", { spaceId: "personal", conversationId: "c" }],
		["companion://updated", { id: "b", bot: {} }],
		["companion://deleted", { id: "b", spaceId: "personal" }],
	] as const

	it.each(CHANGES)("reloads on a local %s", async (event, payload) => {
		const reload = vi.fn()
		renderHook(() => useRosterReloads(reload))
		await settled()

		await emitLocally(event, payload)

		expect(reload).toHaveBeenCalledOnce()
	})

	it.each(CHANGES)(
		"reloads on %s from the joined host only while a joined space is active",
		async (event, payload) => {
			const reload = vi.fn()
			renderHook(() => useRosterReloads(reload))
			await settled()
			await joinHost()
			await settled()

			await emitLocally(event, payload)
			expect(reload).not.toHaveBeenCalled()

			await emitOnHost(event, payload)
			expect(reload).toHaveBeenCalledOnce()
		},
	)

	it("reloads when the joined host comes back up", async () => {
		const reload = vi.fn()
		renderHook(() => useRosterReloads(reload))
		await joinHost()
		await settled()

		await reconnectHost()

		expect(reload).toHaveBeenCalledOnce()
	})
})
