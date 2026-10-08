import { describe, expect, it, vi } from "vitest"

import type { HostSocket } from "./http"
import {
	createJoinedHosts,
	JOINED_SPACE_CHANGED_EVENT,
	type JoinedHosts,
	type JoinedHostsOptions,
	LOCAL_COMMANDS,
} from "./joined-hosts"

import type { JoinedSpaceError } from "../bindings"

const HOST = "http://192.168.1.20:45367"

const socketStub = () => {
	const socket: HostSocket = {
		onopen: null,
		onmessage: null,
		onclose: null,
		close: () => undefined,
	}
	return {
		socket,
		open: () => socket.onopen?.call(socket as WebSocket, new Event("open")),
		drop: () =>
			socket.onclose?.call(
				socket as WebSocket,
				new Event("close") as CloseEvent,
			),
		send: (frame: unknown) =>
			socket.onmessage?.call(
				socket as WebSocket,
				new MessageEvent("message", { data: JSON.stringify(frame) }),
			),
	}
}

const joinedConnection = (id: string) => ({
	status: "ok" as const,
	data: { id, hostUrl: HOST, token: "joined", remoteSpaceId: null, name: id },
})

type Seed = {
	join?: JoinedHostsOptions["join"]
	answer?: () => Response
}

const answerJoined = () =>
	new Response('"joined"', {
		headers: { "content-type": "application/json" },
	})

const joinedHostsOf = ({ join, answer = answerJoined }: Seed = {}) => {
	const localUnlisten = vi.fn()
	const local = {
		invoke: vi.fn(async () => "local" as never),
		listen: vi.fn(async () => localUnlisten),
		fileSrc: vi.fn((path: string) => `asset://${path}`),
	}
	const fetch = vi.fn(async () => answer())
	const sockets: ReturnType<typeof socketStub>[] = []
	const socketUrls: string[] = []
	const reportFailure = vi.fn()
	const reportHostDown = vi.fn(
		() => `notice-${reportHostDown.mock.calls.length}`,
	)
	const endHostDown = vi.fn()
	const joinSpy = vi.fn(join ?? (async (id: string) => joinedConnection(id)))
	const hosts = createJoinedHosts({
		local,
		join: joinSpy,
		fetch,
		openSocket: (url) => {
			const stub = socketStub()
			sockets.push(stub)
			socketUrls.push(url)
			return stub.socket
		},
		reportFailure,
		reportHostDown,
		endHostDown,
	})
	return {
		hosts,
		local,
		localUnlisten,
		fetch,
		sockets,
		socketUrls,
		reportFailure,
		reportHostDown,
		endHostDown,
		join: joinSpy,
	}
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("the local command list", () => {
	it("keeps the local app commands on the local host", () => {
		expect([...LOCAL_COMMANDS]).toEqual(
			expect.arrayContaining([
				"space_list",
				"space_reorder",
				"joined_spaces_list",
				"joined_space_add",
				"joined_space_connect",
				"joined_space_remove",
				"user_preferences",
				"user_set_preferences",
				"window_declare_maximize_button",
				"host_share_link",
			]),
		)
	})

	it("sends no local command and no plugin call to the joined host", async () => {
		const { hosts, local, fetch } = joinedHostsOf()
		await hosts.activate("garage")

		for (const command of [...LOCAL_COMMANDS, "plugin:window|minimize"]) {
			await hosts.invoke(command)
		}

		expect(fetch).not.toHaveBeenCalled()
		expect(local.invoke).toHaveBeenCalledTimes(LOCAL_COMMANDS.size + 1)
	})
})

describe("connecting a joined space", () => {
	it("opens one connection per joined space and reuses it", async () => {
		const { hosts, join, socketUrls } = joinedHostsOf()

		await hosts.connect("garage")
		await hosts.connect("garage")

		expect(join).toHaveBeenCalledOnce()
		expect(join).toHaveBeenCalledWith("garage")
		expect(socketUrls).toEqual([
			"ws://192.168.1.20:45367/api/events?token=joined",
		])
	})

	it("reads connecting, then up once the socket opens, then down when it closes", async () => {
		const { hosts, sockets } = joinedHostsOf()
		const connecting = hosts.connect("garage")
		expect(hosts.getState().connections.garage).toEqual({
			status: "connecting",
		})

		await connecting
		sockets[0]?.open()
		expect(hosts.getState().connections.garage).toEqual({ status: "up" })

		vi.useFakeTimers()
		sockets[0]?.drop()
		vi.useRealTimers()
		expect(hosts.getState().connections.garage).toEqual({ status: "down" })
	})

	it("notifies a subscriber when a connection state changes", async () => {
		const { hosts, sockets } = joinedHostsOf()
		const changed = vi.fn()
		hosts.subscribe(changed)

		await hosts.connect("garage")
		sockets[0]?.open()

		expect(changed).toHaveBeenCalledTimes(2)
	})

	it("records and surfaces the error the local host answers", async () => {
		const refusal: JoinedSpaceError = {
			kind: "unknownJoinedSpace",
			id: "garage",
		}
		const { hosts, reportFailure } = joinedHostsOf({
			join: async () => ({ status: "error", error: refusal }),
		})

		await hosts.connect("garage")

		expect(hosts.getState().connections.garage).toEqual({
			status: "refused",
			failure: "unknownJoinedSpace",
		})
		expect(reportFailure).toHaveBeenCalledWith("unknownJoinedSpace")
	})

	it("records and surfaces a rejected connect, then retries on the next one", async () => {
		const join = vi
			.fn<JoinedHostsOptions["join"]>()
			.mockRejectedValueOnce(new Error("ipc closed"))
			.mockImplementation(async (id) => joinedConnection(id))
		const { hosts, reportFailure } = joinedHostsOf({ join })

		await hosts.connect("garage")
		expect(hosts.getState().connections.garage).toEqual({
			status: "refused",
			failure: "ipc closed",
		})
		expect(reportFailure).toHaveBeenCalledWith("ipc closed")

		await hosts.connect("garage")
		expect(hosts.getState().connections.garage).toEqual({
			status: "connecting",
		})
	})
})

describe("the active host", () => {
	it("starts on the local host and passes every call through untouched", async () => {
		const { hosts, local } = joinedHostsOf()
		const options = { headers: { trace: "1" } }

		await expect(
			hosts.invoke("mission_board", { limit: 3 }, options),
		).resolves.toBe("local")

		expect(hosts.getState().active).toBeNull()
		expect(local.invoke).toHaveBeenCalledWith(
			"mission_board",
			{ limit: 3 },
			options,
		)
	})

	it("sends a call to the joined host with its token while it is active", async () => {
		const { hosts, local, fetch } = joinedHostsOf()

		await hosts.activate("garage")

		await expect(hosts.invoke("mission_board")).resolves.toBe("joined")
		expect(hosts.getState().active).toBe("garage")
		expect(local.invoke).not.toHaveBeenCalled()
		expect(fetch).toHaveBeenCalledWith(
			new URL(`${HOST}/api/invoke/mission_board`),
			expect.objectContaining({
				headers: expect.objectContaining({ authorization: "Bearer joined" }),
			}),
		)
	})

	it("goes back to the local host", async () => {
		const { hosts, local, fetch } = joinedHostsOf()
		await hosts.activate("garage")

		await hosts.activate(null)
		await hosts.invoke("mission_board")

		expect(hosts.getState().active).toBeNull()
		expect(fetch).not.toHaveBeenCalled()
		expect(local.invoke).toHaveBeenCalledOnce()
	})

	it("stays on the local host when the joined space cannot connect", async () => {
		const { hosts } = joinedHostsOf({
			join: async () => ({
				status: "error",
				error: { kind: "undeliverable", detail: "no route" },
			}),
		})

		await hosts.activate("garage")

		expect(hosts.getState().active).toBeNull()
	})

	it("keeps the last requested host when connects settle out of order", async () => {
		const { hosts } = joinedHostsOf()

		const garage = hosts.activate("garage")
		await hosts.activate(null)
		await garage

		expect(hosts.getState().active).toBeNull()
	})

	it("builds file sources on the joined host while it is active", async () => {
		const { hosts } = joinedHostsOf()
		const avatar = "/data/avatars/b1.png"
		expect(hosts.fileSrc(avatar)).toBe(`asset://${avatar}`)

		await hosts.activate("garage")

		expect(hosts.fileSrc(avatar)).toBe(
			`${HOST}/api/files/avatars/b1.png?token=joined`,
		)
	})
})

describe("listening across hosts", () => {
	it("moves a subscription to the joined host and releases the local one", async () => {
		const { hosts, local, localUnlisten, sockets } = joinedHostsOf()
		const missions = vi.fn()
		await hosts.listen("mission://changed", missions)
		expect(local.listen).toHaveBeenCalledWith("mission://changed", missions)

		await hosts.activate("garage")
		await settle()
		sockets[0]?.send({ event: "mission://changed", payload: { id: "m1" } })

		expect(localUnlisten).toHaveBeenCalledOnce()
		expect(missions).toHaveBeenCalledWith(
			expect.objectContaining({ payload: { id: "m1" } }),
		)
	})

	it("moves a subscription back to the local host and releases the joined one", async () => {
		const { hosts, local, sockets } = joinedHostsOf()
		const missions = vi.fn()
		await hosts.activate("garage")
		await hosts.listen("mission://changed", missions)
		expect(local.listen).not.toHaveBeenCalled()

		await hosts.activate(null)
		await settle()
		sockets[0]?.send({ event: "mission://changed", payload: {} })

		expect(missions).not.toHaveBeenCalled()
		expect(local.listen).toHaveBeenCalledWith("mission://changed", missions)
	})

	it("keeps a local event on the local host", async () => {
		const { hosts, local, localUnlisten } = joinedHostsOf()
		await hosts.activate("garage")

		await hosts.listen("window-maximize-button", vi.fn())
		await hosts.activate(null)
		await settle()

		expect(local.listen).toHaveBeenCalledOnce()
		expect(localUnlisten).not.toHaveBeenCalled()
	})

	it("stops moving a subscription once it is released", async () => {
		const { hosts, local, localUnlisten } = joinedHostsOf()
		const unlisten = await hosts.listen("mission://changed", vi.fn())

		unlisten()
		await settle()
		await hosts.activate("garage")
		await settle()

		expect(localUnlisten).toHaveBeenCalledOnce()
		expect(local.listen).toHaveBeenCalledOnce()
	})
})

describe("listening to the active host only", () => {
	it("hears nothing while the local host is active", async () => {
		const { hosts, local } = joinedHostsOf()

		await hosts.listenToActiveHost("companion://created", vi.fn())

		expect(local.listen).not.toHaveBeenCalled()
	})

	it("hears a local event emitted by the joined host once it is active", async () => {
		const { hosts, local, sockets } = joinedHostsOf()
		const fromHost = vi.fn()
		await hosts.listenToActiveHost("companion://created", fromHost)

		await hosts.activate("garage")
		await settle()
		sockets[0]?.send({ event: "companion://created", payload: { id: "b9" } })

		expect(local.listen).not.toHaveBeenCalled()
		expect(fromHost).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ payload: { id: "b9" } }),
		)
	})

	it("stops hearing the joined host once the local host is active again", async () => {
		const { hosts, sockets } = joinedHostsOf()
		const fromHost = vi.fn()
		await hosts.activate("garage")
		await hosts.listenToActiveHost("companion://created", fromHost)

		await hosts.activate(null)
		await settle()
		sockets[0]?.send({ event: "companion://created", payload: { id: "b9" } })

		expect(fromHost).not.toHaveBeenCalled()
	})

	it("keeps the local subscription to the same event on the local host", async () => {
		const { hosts, local, sockets } = joinedHostsOf()
		const fromLocal = vi.fn()
		await hosts.listen("companion://created", fromLocal)

		await hosts.activate("garage")
		await settle()
		sockets[0]?.send({ event: "companion://created", payload: { id: "b9" } })

		expect(local.listen).toHaveBeenCalledOnce()
		expect(fromLocal).not.toHaveBeenCalled()
	})
})

describe("a joined space event", () => {
	it("stays on the local host while a joined host is active", async () => {
		const { hosts, local } = joinedHostsOf()
		await hosts.activate("garage")

		await hosts.listen(JOINED_SPACE_CHANGED_EVENT, vi.fn())

		expect(local.listen).toHaveBeenCalledWith(
			JOINED_SPACE_CHANGED_EVENT,
			expect.any(Function),
		)
	})
})

describe("a failing selected host", () => {
	it("raises a notice when the active joined host goes down", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf()
		await hosts.activate("garage")

		sockets[0]?.drop()

		expect(hosts.getState().connections.garage).toEqual({ status: "down" })
		expect(reportHostDown).toHaveBeenCalledOnce()
	})

	it("raises no notice when a joined host that is not selected goes down", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf()
		await hosts.connect("garage")

		sockets[0]?.drop()

		expect(hosts.getState().connections.garage).toEqual({ status: "down" })
		expect(reportHostDown).not.toHaveBeenCalled()
	})

	it("raises a notice when an unreachable joined host is selected", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf()
		await hosts.connect("garage")
		sockets[0]?.drop()

		await hosts.activate("garage")

		expect(reportHostDown).toHaveBeenCalledOnce()
	})
})

describe("an offline joined host", () => {
	const answerOffline = () =>
		new Response("the host of this space is offline", { status: 503 })

	const requestsOf = (hosts: JoinedHosts, count: number) =>
		Promise.allSettled(
			Array.from({ length: count }, () => hosts.invoke("bot_list")),
		)

	it("raises one notice however many requests fail", async () => {
		const { hosts, reportHostDown } = joinedHostsOf({ answer: answerOffline })
		await hosts.activate("garage")

		await requestsOf(hosts, 4)
		await requestsOf(hosts, 2)

		expect(reportHostDown).toHaveBeenCalledOnce()
	})

	it("raises one notice when the socket closes before and after failing requests", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")

		await requestsOf(hosts, 2)
		sockets[0]?.drop()
		await requestsOf(hosts, 2)

		expect(reportHostDown).toHaveBeenCalledOnce()
	})

	it("raises one notice when the socket closes first", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")

		sockets[0]?.drop()
		await requestsOf(hosts, 3)

		expect(reportHostDown).toHaveBeenCalledOnce()
	})

	it("ends the notice when another space becomes active", async () => {
		const { hosts, reportHostDown, endHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")
		await requestsOf(hosts, 2)

		await hosts.activate(null)

		expect(endHostDown).toHaveBeenCalledExactlyOnceWith(
			reportHostDown.mock.results[0]?.value,
		)
	})

	it("raises the notice once more when the space is active again while still down", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")
		await requestsOf(hosts, 2)
		await hosts.activate(null)

		await hosts.activate("garage")
		await requestsOf(hosts, 3)
		sockets[0]?.drop()

		expect(reportHostDown).toHaveBeenCalledTimes(2)
	})

	it("ends the notice when the space is forgotten and raises it again on rejoin", async () => {
		const { hosts, reportHostDown, endHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")
		await requestsOf(hosts, 2)

		hosts.forget("garage")
		await settle()

		expect(endHostDown).toHaveBeenCalledExactlyOnceWith(
			reportHostDown.mock.results[0]?.value,
		)

		await hosts.activate("garage")
		await requestsOf(hosts, 2)

		expect(reportHostDown).toHaveBeenCalledTimes(2)
	})

	it("ends the notice once a request succeeds while the socket stays open", async () => {
		const answers = [answerOffline, answerOffline, answerJoined]
		const { hosts, sockets, reportHostDown, endHostDown } = joinedHostsOf({
			answer: () => (answers.shift() ?? answerJoined)(),
		})
		await hosts.activate("garage")
		sockets[0]?.open()

		await requestsOf(hosts, 2)
		await requestsOf(hosts, 1)

		expect(endHostDown).toHaveBeenCalledExactlyOnceWith(
			reportHostDown.mock.results[0]?.value,
		)
		expect(hosts.getState().connections.garage).toEqual({ status: "up" })
	})

	it("ends the notice once the host comes back up", async () => {
		const { hosts, sockets, reportHostDown, endHostDown } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")
		await requestsOf(hosts, 2)
		sockets[0]?.drop()

		sockets[0]?.open()

		expect(endHostDown).toHaveBeenCalledExactlyOnceWith(
			reportHostDown.mock.results[0]?.value,
		)
	})

	it("raises no request refusal for the failing requests", async () => {
		const { hosts, sockets, reportFailure } = joinedHostsOf({
			answer: answerOffline,
		})
		await hosts.activate("garage")

		await requestsOf(hosts, 3)
		sockets[0]?.drop()

		expect(reportFailure).not.toHaveBeenCalled()
	})

	it("keeps refusing a request that fails for another cause", async () => {
		const { hosts, reportFailure, reportHostDown } = joinedHostsOf({
			answer: () => new Response("the host broke", { status: 502 }),
		})
		await hosts.activate("garage")

		await requestsOf(hosts, 2)

		expect(reportFailure).toHaveBeenCalledTimes(2)
		expect(reportFailure).toHaveBeenCalledWith("the host broke", 502)
		expect(reportHostDown).not.toHaveBeenCalled()
	})

	it("raises no notice while the host is online", async () => {
		const { hosts, sockets, reportHostDown } = joinedHostsOf()
		await hosts.activate("garage")
		sockets[0]?.open()

		await requestsOf(hosts, 3)

		expect(reportHostDown).not.toHaveBeenCalled()
	})
})

describe("forgetting a joined host", () => {
	it("closes its socket, drops its state and stops reconnecting", async () => {
		vi.useFakeTimers()
		const { hosts, sockets } = joinedHostsOf()
		await hosts.connect("garage")
		const closing = vi.spyOn(sockets[0]?.socket as HostSocket, "close")

		hosts.forget("garage")
		sockets[0]?.drop()
		await vi.runAllTimersAsync()

		expect(closing).toHaveBeenCalledOnce()
		expect(hosts.getState().connections).toEqual({})
		expect(sockets).toHaveLength(1)
		vi.useRealTimers()
	})

	it("goes back to the local host when the forgotten host was active", async () => {
		const { hosts, local } = joinedHostsOf()
		await hosts.activate("garage")

		hosts.forget("garage")
		await hosts.invoke("bots")

		expect(hosts.getState().active).toBeNull()
		expect(local.invoke).toHaveBeenCalledWith("bots")
	})
})
