import { afterEach, describe, expect, it, vi } from "vitest"

import {
	createJoinedSpacesController,
	type JoinedSpacesTransport,
	remoteMarksOf,
	rosterSpaceIdsOf,
	switcherSpacesOf,
} from "./joined-spaces-controller"
import { createSpacesController } from "./spaces-controller"

import type { JoinedSpace, JoinedSpaceError } from "../bindings"
import { createStore } from "../store"
import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import type { JoinedHostState, JoinedHostsState } from "../host/joined-hosts"

const GARAGE: JoinedSpace = {
	id: "joined-garage",
	hostUrl: "http://192.168.1.20:45367",
	remoteSpaceId: "garage",
	name: "Garage",
}

const ATTIC: JoinedSpace = {
	id: "joined-attic",
	hostUrl: "http://192.168.1.21:45367",
	remoteSpaceId: "attic",
	name: "Attic",
}

const REFUSED_LINK: JoinedSpaceError = {
	kind: "refusedLink",
	part: "token",
	message: "not a Kiroshi link",
}

const hostsFake = () => {
	const store = createStore<JoinedHostsState>({ active: null, connections: {} })
	const answers = new Map<string, JoinedHostState>()
	const record = (id: string, state: JoinedHostState) =>
		store.setState({
			...store.getState(),
			connections: { ...store.getState().connections, [id]: state },
		})
	return {
		getState: store.getState,
		subscribe: store.subscribe,
		connect: vi.fn(async (id: string) => {
			const answer = answers.get(id)
			if (answer) record(id, answer)
		}),
		activate: vi.fn(async (id: string | null) => {
			store.setState({ ...store.getState(), active: id })
		}),
		forget: vi.fn(),
		answer: (id: string, state: JoinedHostState) => answers.set(id, state),
		record,
	}
}

const transportFake = (listed: JoinedSpace[] = []) => {
	let held = [...listed]
	let announce: () => void = () => undefined
	const transport = {
		list: vi.fn(async () => held),
		add: vi.fn(async (_link: string): Promise<JoinedSpace> => {
			held = [...held, GARAGE]
			return GARAGE
		}),
		remove: vi.fn(async (id: string) => {
			held = held.filter((joined) => joined.id !== id)
		}),
		onChanged: vi.fn(async (listener: () => void) => {
			announce = listener
			return () => undefined
		}),
	} satisfies JoinedSpacesTransport
	return {
		transport,
		announce: () => announce(),
		hold: (next: JoinedSpace[]) => {
			held = next
		},
	}
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const gearFor = async (listed: JoinedSpace[] = []) => {
	const store = createFakeTranscriptStore()
	const home = await store.createSpace("Home")
	const spaces = createSpacesController(store)
	await spaces.load(home.id)
	const hosts = hostsFake()
	const wire = transportFake(listed)
	const reportFailure = vi.fn()
	const joined = createJoinedSpacesController({
		spaces,
		hosts,
		transport: wire.transport,
		reportFailure,
		probeTimeout: 50,
	})
	return { home, spaces, hosts, wire, reportFailure, joined }
}

afterEach(() => {
	vi.useRealTimers()
})

describe("the switcher rows", () => {
	it("lists the joined spaces after the local ones, named by the link", () => {
		const local = [{ id: "home", name: "Home", colour: null, position: 0 }]

		expect(switcherSpacesOf(local as never, [GARAGE])).toEqual([
			local[0],
			{ id: "garage", name: "Garage" },
		])
	})

	it("marks a joined space unreachable once its host is down or refused", () => {
		expect(
			remoteMarksOf(
				[GARAGE, ATTIC, { ...ATTIC, id: "j3", remoteSpaceId: "loft" }],
				{
					[GARAGE.id]: { status: "up" },
					[ATTIC.id]: { status: "down" },
					j3: { status: "refused", failure: "gone" },
				},
			),
		).toEqual({
			garage: "connected",
			attic: "unreachable",
			loft: "unreachable",
		})
	})

	it("keeps a joined space connected while its host is still connecting", () => {
		expect(
			remoteMarksOf([GARAGE], { [GARAGE.id]: { status: "connecting" } }),
		).toEqual({ garage: "connected" })
	})

	it("falls back to the joined id when the link names no remote space", () => {
		expect(switcherSpacesOf([], [{ ...GARAGE, remoteSpaceId: null }])).toEqual([
			{ id: GARAGE.id, name: "Garage" },
		])
	})
})

describe("the roster spaces", () => {
	it("reads the local spaces while the local host is active", () => {
		const local = [{ id: "home" }, { id: "work" }]

		expect(rosterSpaceIdsOf(local as never, [GARAGE], null)).toEqual([
			"home",
			"work",
		])
	})

	it("reads the remote space alone while its host is active", () => {
		expect(rosterSpaceIdsOf([], [GARAGE], GARAGE.id)).toEqual(["garage"])
	})
})

describe("watching the joined spaces", () => {
	it("lists them and connects each host", async () => {
		const { joined, hosts } = await gearFor([GARAGE, ATTIC])

		joined.watch()
		await settle()

		expect(joined.getState().joinedSpaces).toEqual([GARAGE, ATTIC])
		expect(hosts.connect).toHaveBeenCalledWith(GARAGE.id)
		expect(hosts.connect).toHaveBeenCalledWith(ATTIC.id)
	})

	it("lists them again when a joined space changes", async () => {
		const { joined, wire } = await gearFor()
		joined.watch()
		await settle()

		wire.hold([ATTIC])
		wire.announce()
		await settle()

		expect(joined.getState().joinedSpaces).toEqual([ATTIC])
	})

	it("records a failed list and raises it", async () => {
		const { joined, wire, reportFailure } = await gearFor()
		wire.transport.list.mockRejectedValueOnce(new Error("database locked"))

		joined.watch()
		await settle()

		expect(joined.getState().hasFailedToLoad).toBe(true)
		expect(reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "database locked" }),
		)
	})
})

describe("selecting a space", () => {
	it("activates the host of a remote row", async () => {
		const { joined, spaces, hosts } = await gearFor([GARAGE])
		joined.watch()
		await settle()

		joined.selectSpace("garage")

		expect(spaces.getState().selectedSpaceId).toBe("garage")
		expect(hosts.activate).toHaveBeenLastCalledWith(GARAGE.id)
	})

	it("activates the local host for a local row", async () => {
		const { joined, spaces, hosts, home } = await gearFor([GARAGE])
		joined.watch()
		await settle()
		joined.selectSpace("garage")

		joined.selectSpace(home.id)

		expect(spaces.getState().selectedSpaceId).toBe(home.id)
		expect(hosts.activate).toHaveBeenLastCalledWith(null)
	})
})

describe("joining a space", () => {
	const joinWith = async (gear: Awaited<ReturnType<typeof gearFor>>) => {
		gear.joined.openJoin()
		gear.joined.changeJoinLink("  kiroshi://192.168.1.20  ")
		await gear.joined.join()
	}

	it("adds the trimmed link", async () => {
		const gear = await gearFor()
		gear.hosts.answer(GARAGE.id, { status: "up" })

		await joinWith(gear)

		expect(gear.wire.transport.add).toHaveBeenCalledWith(
			"kiroshi://192.168.1.20",
		)
	})

	it("shows invalidLink when the link is refused", async () => {
		const gear = await gearFor()
		gear.wire.transport.add.mockRejectedValueOnce(REFUSED_LINK)

		await joinWith(gear)

		expect(gear.joined.getState()).toMatchObject({
			isJoinOpen: true,
			joinState: "invalidLink",
		})
		expect(gear.hosts.connect).not.toHaveBeenCalled()
	})

	it("clears the message once the link is edited", async () => {
		const gear = await gearFor()
		gear.wire.transport.add.mockRejectedValueOnce(REFUSED_LINK)
		await joinWith(gear)

		gear.joined.changeJoinLink("kiroshi://192.168.1.21")

		expect(gear.joined.getState().joinState).toBe("idle")
	})

	it("raises any other refusal and lets the reader retry", async () => {
		const gear = await gearFor()
		gear.wire.transport.add.mockRejectedValueOnce({
			kind: "undeliverable",
			detail: "event bus closed",
		})

		await joinWith(gear)

		expect(gear.joined.getState().joinState).toBe("idle")
		expect(gear.reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "event bus closed" }),
		)
	})

	it("closes the dialog and selects the new row once the host answers", async () => {
		const gear = await gearFor()
		gear.hosts.answer(GARAGE.id, { status: "up" })

		await joinWith(gear)

		expect(gear.joined.getState()).toMatchObject({
			isJoinOpen: false,
			joinLink: "",
			joinState: "idle",
			joinedSpaces: [GARAGE],
		})
		expect(gear.spaces.getState().selectedSpaceId).toBe("garage")
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(GARAGE.id)
	})

	it("waits for a connecting host to answer", async () => {
		const gear = await gearFor()
		gear.hosts.answer(GARAGE.id, { status: "connecting" })

		const joining = joinWith(gear)
		await settle()
		expect(gear.joined.getState().joinState).toBe("joining")
		gear.hosts.record(GARAGE.id, { status: "up" })
		await joining

		expect(gear.joined.getState().isJoinOpen).toBe(false)
	})

	it("shows hostUnreachable, raises it and removes the space when the host is down", async () => {
		const gear = await gearFor()
		gear.hosts.answer(GARAGE.id, { status: "down" })

		await joinWith(gear)

		expect(gear.joined.getState()).toMatchObject({
			isJoinOpen: true,
			joinState: "hostUnreachable",
			joinedSpaces: [],
		})
		expect(gear.wire.transport.remove).toHaveBeenCalledWith(GARAGE.id)
		expect(gear.hosts.forget).toHaveBeenCalledWith(GARAGE.id)
		expect(gear.reportFailure).toHaveBeenCalledOnce()
		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
	})

	it("gives up on a host that never answers", async () => {
		vi.useFakeTimers()
		const gear = await gearFor()
		gear.hosts.answer(GARAGE.id, { status: "connecting" })

		const joining = joinWith(gear)
		await vi.advanceTimersByTimeAsync(50)
		await joining

		expect(gear.joined.getState().joinState).toBe("hostUnreachable")
		expect(gear.wire.transport.remove).toHaveBeenCalledWith(GARAGE.id)
	})
})

describe("leaving a space", () => {
	const leavingGarage = async () => {
		const gear = await gearFor([GARAGE])
		gear.joined.watch()
		await settle()
		gear.joined.selectSpace("garage")
		gear.joined.askToLeave()
		return gear
	}

	it("removes the selected space and selects the first local one", async () => {
		const gear = await leavingGarage()

		await gear.joined.leave()

		expect(gear.wire.transport.remove).toHaveBeenCalledWith(GARAGE.id)
		expect(gear.hosts.forget).toHaveBeenCalledWith(GARAGE.id)
		const [firstLocal] = gear.spaces.getState().spaces
		expect(gear.joined.getState().joinedSpaces).toEqual([])
		expect(gear.spaces.getState().selectedSpaceId).toBe(firstLocal?.id)
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
	})

	it("keeps the selection when the space left is not the selected one", async () => {
		const gear = await leavingGarage()
		gear.joined.selectSpace(gear.home.id)
		gear.hosts.activate.mockClear()

		await gear.joined.leave()

		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
		expect(gear.hosts.activate).not.toHaveBeenCalled()
	})

	it("raises a refused removal and keeps the space", async () => {
		const gear = await leavingGarage()
		gear.wire.transport.remove.mockRejectedValueOnce(new Error("disk full"))

		await expect(gear.joined.leave()).rejects.toThrow("disk full")

		expect(gear.joined.getState().joinedSpaces).toEqual([GARAGE])
		expect(gear.hosts.forget).not.toHaveBeenCalled()
		expect(gear.reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "disk full" }),
		)
	})
})
