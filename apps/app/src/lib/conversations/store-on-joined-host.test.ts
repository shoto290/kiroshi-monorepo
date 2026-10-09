import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readConversation } from "./read-conversation"
import { conversationStore } from "./store-transport"
import { botIdentity } from "./transcript-fixtures"

import type { HostSocket } from "../host/http"

const HOST = "http://192.168.1.20:45367"
const JOINED_ID = "garage"
const HOST_SPACE_ID = "space-on-host"
const GUEST_SPACE_ID = "space-of-the-guest"

type Call = [command: string, args: unknown]

const wire = vi.hoisted(() => ({
	localCalls: [] as [string, unknown][],
	hostCalls: [] as [string, unknown][],
}))

vi.mock("../host", async () => {
	const { createJoinedHosts } = await import("../host/joined-hosts")
	const joinedHosts = createJoinedHosts({
		local: {
			invoke: (async (command: string, args: unknown) => {
				wire.localCalls.push([command, args])
				return command === "space_list" ? [{ id: GUEST_SPACE_ID }] : []
			}) as never,
			listen: async () => () => undefined,
			fileSrc: (path) => path,
		},
		join: async (id) => ({
			status: "ok",
			data: {
				id,
				hostUrl: HOST,
				token: "joined",
				remoteSpaceId: HOST_SPACE_ID,
				name: id,
			},
		}),
		fetch: async (input, init) => {
			const command = decodeURIComponent(String(input).split("/").pop() ?? "")
			wire.hostCalls.push([command, JSON.parse(String(init?.body))])
			return new Response(
				JSON.stringify(
					command === "conversation_main_chat" ? { id: "chat" } : [],
				),
				{
					headers: { "content-type": "application/json" },
				},
			)
		},
		openSocket: () =>
			({
				onopen: null,
				onmessage: null,
				onclose: null,
				close: () => undefined,
			}) satisfies HostSocket,
		reportFailure: () => undefined,
		reportHostDown: () => "notice",
		endHostDown: () => undefined,
	})
	return {
		joinedHosts,
		invoke: joinedHosts.invoke,
		listen: joinedHosts.listen,
		activeJoinedSpaceId: joinedHosts.activeSpaceId,
	}
})

const { joinedHosts } = await import("../host")

const callsOf = (calls: Call[], command: string) =>
	calls.filter(([sent]) => sent === command).map(([, args]) => args)

describe("store calls on a guest of a shared space", () => {
	beforeEach(async () => {
		wire.localCalls.length = 0
		wire.hostCalls.length = 0
		await joinedHosts.activate(JOINED_ID)
	})

	afterEach(() => {
		joinedHosts.forget(JOINED_ID)
	})

	it("reads the companions of the host space", async () => {
		await conversationStore.bots()

		expect(callsOf(wire.hostCalls, "conversation_bots")).toEqual([
			{ spaceId: HOST_SPACE_ID },
		])
	})

	it("reads the main chat of the host space", async () => {
		await conversationStore.mainChat("b-1")

		expect(callsOf(wire.hostCalls, "conversation_main_chat")).toEqual([
			{ botId: "b-1", spaceId: HOST_SPACE_ID },
		])
	})

	it("moves a companion between sections of the host space", async () => {
		await conversationStore.moveBotToSection("b-1", "n-1")

		expect(callsOf(wire.hostCalls, "bot_move_to_section")).toEqual([
			{ botId: "b-1", sectionId: "n-1", spaceId: HOST_SPACE_ID },
		])
	})

	it("creates a companion in the host space", async () => {
		const identity = botIdentity({ name: "Ada" })

		await conversationStore.createBot(identity, null)

		expect(callsOf(wire.hostCalls, "conversation_create_bot")).toEqual([
			{ identity, spaceId: HOST_SPACE_ID },
		])
	})

	it("duplicates a companion into the host space", async () => {
		await conversationStore.duplicateBot("b-1")

		expect(callsOf(wire.hostCalls, "conversation_duplicate_bot")).toEqual([
			{ botId: "b-1", spaceId: HOST_SPACE_ID },
		])
	})

	it("reads a conversation in the host space and never in a local one", async () => {
		await readConversation(conversationStore, "c-1")

		expect(callsOf(wire.localCalls, "space_list")).toEqual([])
		expect(callsOf(wire.hostCalls, "conversation_list")).toEqual([
			{ spaceId: HOST_SPACE_ID },
		])
	})
})

describe("store calls with no joined space", () => {
	beforeEach(async () => {
		wire.localCalls.length = 0
		await joinedHosts.activate(null)
	})

	it("sends the space arguments as before", async () => {
		await conversationStore.bots()
		await conversationStore.mainChat("b-1")
		await conversationStore.moveBotToSection("b-1", null)
		await readConversation(conversationStore, "c-1")

		expect(wire.localCalls).toEqual([
			["conversation_bots", { spaceId: null }],
			["conversation_main_chat", { botId: "b-1", spaceId: null }],
			["bot_move_to_section", { botId: "b-1", sectionId: null }],
			["space_list", undefined],
			["conversation_list", { spaceId: GUEST_SPACE_ID }],
		])
	})
})
