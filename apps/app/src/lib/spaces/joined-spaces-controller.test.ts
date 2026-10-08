import { afterEach, describe, expect, it, vi } from "vitest"

import {
	createJoinedSpacesController,
	type JoinedSpacesTransport,
	openLocalSpaceOf,
	openRowIdOf,
	remoteMarksOf,
	rosterSpaceIdsOf,
	shownJoinedSpacesOf,
	switcherSpacesOf,
} from "./joined-spaces-controller"
import { createSpacesController } from "./spaces-controller"

import type {
	JoinedSpace,
	JoinedSpaceError,
	JoinedSpaceRemoved,
} from "../bindings"
import { createStore } from "../store"
import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import type { JoinedHostState, JoinedHostsState } from "../host/joined-hosts"

const GARAGE: JoinedSpace = {
	id: "joined-garage",
	hostUrl: "http://192.168.1.20:45367",
	remoteSpaceId: "garage",
	name: "Garage",
}

const GARAGE_ROW = "joined:joined-garage"

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
	let announceRemoval: (removed: JoinedSpaceRemoved) => void = () => undefined
	const transport = {
		list: vi.fn(async () => held),
		add: vi.fn(async (_link: string): Promise<JoinedSpace> => {
			held = [...held, GARAGE]
			announce()
			return GARAGE
		}),
		remove: vi.fn(async (id: string) => {
			held = held.filter((joined) => joined.id !== id)
		}),
		onChanged: vi.fn(async (listener: () => void) => {
			announce = listener
			return () => undefined
		}),
		onRemoved: vi.fn(
			async (listener: (removed: JoinedSpaceRemoved) => void) => {
				announceRemoval = listener
				return () => undefined
			},
		),
	} satisfies JoinedSpacesTransport
	return {
		transport,
		announce: () => announce(),
		evict: (joined: JoinedSpace) => {
			held = held.filter((entry) => entry.id !== joined.id)
			announce()
			announceRemoval({ id: joined.id, name: joined.name })
		},
		hold: (next: JoinedSpace[]) => {
			held = next
		},
	}
}

const invitersFake = () => {
	const emails = new Map<string, string>()
	return {
		of: (id: string) => emails.get(id) ?? "",
		remember: (id: string, email: string) => {
			emails.set(id, email)
		},
		forget: (id: string) => {
			emails.delete(id)
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
	const reportRemoval = vi.fn()
	const inviters = invitersFake()
	const joined = createJoinedSpacesController({
		spaces,
		hosts,
		transport: wire.transport,
		reportFailure,
		reportRemoval,
		inviters,
		probeTimeout: 50,
	})
	return { home, spaces, hosts, wire, reportFailure, reportRemoval, joined }
}

afterEach(() => {
	vi.useRealTimers()
})

describe("the switcher rows", () => {
	it("lists the joined spaces after the local ones, named by the link", () => {
		const local = [{ id: "home", name: "Home", colour: null, position: 0 }]

		expect(switcherSpacesOf(local as never, [GARAGE])).toEqual([
			local[0],
			{ id: GARAGE_ROW, name: "Garage" },
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
			[GARAGE_ROW]: "connected",
			"joined:joined-attic": "unreachable",
			"joined:j3": "unreachable",
		})
	})

	it("keeps a joined space connected while its host is still connecting", () => {
		expect(
			remoteMarksOf([GARAGE], { [GARAGE.id]: { status: "connecting" } }),
		).toEqual({ [GARAGE_ROW]: "connected" })
	})

	it("keeps a joined row apart from a local space carrying the same id", () => {
		const local = [{ id: "personal", name: "Personal" }]
		const hostPersonal = { ...GARAGE, remoteSpaceId: "personal" }

		expect(switcherSpacesOf(local as never, [hostPersonal])).toEqual([
			local[0],
			{ id: GARAGE_ROW, name: "Garage" },
		])
		expect(
			remoteMarksOf([hostPersonal], { [GARAGE.id]: { status: "up" } }),
		).toEqual({ [GARAGE_ROW]: "connected" })
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

	it("falls back to the joined id when the link names no remote space", () => {
		expect(
			rosterSpaceIdsOf([], [{ ...GARAGE, remoteSpaceId: null }], GARAGE.id),
		).toEqual([GARAGE.id])
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

		joined.selectSpace(GARAGE_ROW)

		expect(spaces.getState().selectedSpaceId).toBe("garage")
		expect(hosts.activate).toHaveBeenLastCalledWith(GARAGE.id)
	})

	it("activates the local host for a local row", async () => {
		const { joined, spaces, hosts, home } = await gearFor([GARAGE])
		joined.watch()
		await settle()
		joined.selectSpace(GARAGE_ROW)

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

describe("a changed read during a join", () => {
	const probingGarage = async () => {
		const gear = await gearFor()
		gear.joined.watch()
		await settle()
		const shownRows: string[][] = []
		const shownMarks: string[][] = []
		gear.joined.subscribe(() => {
			const { joinedSpaces } = gear.joined.getState()
			shownRows.push(switcherSpacesOf([], joinedSpaces).map((row) => row.id))
			shownMarks.push(
				Object.keys(
					remoteMarksOf(joinedSpaces, gear.hosts.getState().connections),
				),
			)
		})
		gear.hosts.answer(GARAGE.id, { status: "connecting" })
		gear.joined.openJoin()
		gear.joined.changeJoinLink("kiroshi://192.168.1.20")
		const joining = gear.joined.join()
		await settle()
		gear.wire.announce()
		await settle()
		return { ...gear, joining, shownRows, shownMarks }
	}

	it("lists no row and no mark for the space being probed", async () => {
		const gear = await probingGarage()

		expect(gear.wire.transport.list).toHaveBeenCalledTimes(3)
		expect(gear.joined.getState().joinState).toBe("joining")
		expect(gear.shownRows.flat()).not.toContain("garage")
		expect(gear.shownMarks.flat()).not.toContain("garage")
		expect(gear.hosts.connect).toHaveBeenCalledTimes(1)
	})

	it("shows and selects the row once the probe succeeds", async () => {
		const gear = await probingGarage()

		gear.hosts.record(GARAGE.id, { status: "up" })
		await gear.joining

		expect(gear.joined.getState().joinedSpaces).toEqual([GARAGE])
		expect(gear.spaces.getState().selectedSpaceId).toBe("garage")
	})

	it("never shows the row when the probe fails", async () => {
		const gear = await probingGarage()

		gear.hosts.record(GARAGE.id, { status: "down" })
		gear.wire.announce()
		await gear.joining
		await settle()

		expect(gear.joined.getState().joinState).toBe("hostUnreachable")
		expect(gear.shownRows.flat()).not.toContain("garage")
		expect(gear.shownMarks.flat()).not.toContain("garage")
	})
})

describe("leaving a space", () => {
	const leavingGarage = async () => {
		const gear = await gearFor([GARAGE])
		gear.joined.watch()
		await settle()
		gear.joined.selectSpace(GARAGE_ROW)
		gear.joined.askToLeave()
		return gear
	}

	it("removes the selected space, closes its settings and selects the first local one", async () => {
		const gear = await leavingGarage()
		gear.spaces.setSettingsOpen(true)

		await gear.joined.leave(GARAGE.id)

		expect(gear.wire.transport.remove).toHaveBeenCalledWith(GARAGE.id)
		expect(gear.hosts.forget).toHaveBeenCalledWith(GARAGE.id)
		const [firstLocal] = gear.spaces.getState().spaces
		expect(gear.joined.getState().joinedSpaces).toEqual([])
		expect(gear.spaces.getState().selectedSpaceId).toBe(firstLocal?.id)
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
		expect(gear.spaces.getState().isSettingsOpen).toBe(false)
	})

	it("keeps the selection when the space left is not the selected one", async () => {
		const gear = await leavingGarage()
		gear.joined.selectSpace(gear.home.id)
		gear.hosts.activate.mockClear()

		await gear.joined.leave(GARAGE.id)

		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
		expect(gear.hosts.activate).not.toHaveBeenCalled()
	})

	it("raises a refused removal and keeps the space", async () => {
		const gear = await leavingGarage()
		gear.wire.transport.remove.mockRejectedValueOnce(new Error("disk full"))

		await expect(gear.joined.leave(GARAGE.id)).rejects.toThrow("disk full")

		expect(gear.joined.getState().joinedSpaces).toEqual([GARAGE])
		expect(gear.hosts.forget).not.toHaveBeenCalled()
		expect(gear.reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "disk full" }),
		)
	})
})

const STUDIO: JoinedSpace = {
	id: "joined-studio",
	hostUrl: "wss://cloud.kiroshi.test/instances/studio/relay/member",
	remoteSpaceId: "studio",
	name: "Studio Nord",
}

const STUDIO_ROW = "joined:joined-studio"

const HOST_EMAIL = "lea@example.com"

const REMOVED_NOTICE = "lea@example.com removed you from Studio Nord."

const withStudio = async () => {
	const gear = await gearFor([STUDIO])
	gear.joined.watch()
	await settle()
	return gear
}

describe("accepting an invited space", () => {
	it("adds the space as a remote row, connects it and opens it", async () => {
		const gear = await gearFor()
		gear.joined.watch()
		await settle()
		gear.wire.hold([STUDIO])

		await gear.joined.admit(STUDIO, HOST_EMAIL)

		expect(gear.joined.getState().joinedSpaces).toEqual([STUDIO])
		expect(gear.hosts.connect).toHaveBeenCalledWith(STUDIO.id)
		expect(gear.spaces.getState().selectedSpaceId).toBe("studio")
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(STUDIO.id)
		expect(gear.joined.hostEmailOf(STUDIO.id)).toBe(HOST_EMAIL)
	})
})

describe("a host removing the reader", () => {
	it("holds the open space as removed, then Back opens the previous local space, drops the row and raises the notice", async () => {
		const gear = await withStudio()
		await gear.joined.admit(STUDIO, HOST_EMAIL)

		gear.wire.evict(STUDIO)
		await settle()

		const shown = shownJoinedSpacesOf(gear.joined.getState())
		expect(gear.joined.getState().removed).toEqual({
			joined: STUDIO,
			hostEmail: HOST_EMAIL,
			backSpaceId: gear.home.id,
		})
		expect(switcherSpacesOf([], shown)).toEqual([
			{ id: STUDIO_ROW, name: "Studio Nord" },
		])
		expect(gear.reportRemoval).not.toHaveBeenCalled()

		gear.joined.leaveRemoved()

		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
		expect(gear.joined.getState().removed).toBe(null)
		expect(shownJoinedSpacesOf(gear.joined.getState())).toEqual([])
		expect(gear.hosts.forget).toHaveBeenCalledWith(STUDIO.id)
		expect(gear.reportRemoval).toHaveBeenCalledWith(REMOVED_NOTICE)
	})

	it("drops a space that is not open and raises the notice", async () => {
		const gear = await withStudio()
		await gear.joined.admit(STUDIO, HOST_EMAIL)
		gear.joined.selectSpace(gear.home.id)

		gear.wire.evict(STUDIO)
		await settle()

		expect(gear.joined.getState().removed).toBe(null)
		expect(gear.joined.getState().joinedSpaces).toEqual([])
		expect(gear.hosts.forget).toHaveBeenCalledWith(STUDIO.id)
		expect(gear.reportRemoval).toHaveBeenCalledWith(REMOVED_NOTICE)
	})

	it("keeps an unreachable host as an unreachable row, never as removed", async () => {
		const gear = await withStudio()
		gear.joined.selectSpace(STUDIO_ROW)

		gear.hosts.record(STUDIO.id, { status: "down" })

		expect(gear.joined.getState().removed).toBe(null)
		expect(
			remoteMarksOf(
				gear.joined.getState().joinedSpaces,
				gear.hosts.getState().connections,
			),
		).toEqual({ [STUDIO_ROW]: "unreachable" })
	})
})

describe("a read dropping a joined space", () => {
	it("moves the reader from an open relay space dropped by sign out to the local space", async () => {
		const gear = await withStudio()
		await gear.joined.admit(STUDIO, HOST_EMAIL)
		expect(gear.spaces.getState().selectedSpaceId).toBe("studio")

		gear.wire.hold([])
		gear.wire.announce()
		await settle()

		expect(gear.joined.getState().joinedSpaces).toEqual([])
		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
		expect(gear.hosts.forget).toHaveBeenCalledWith(STUDIO.id)
		expect(gear.joined.hostEmailOf(STUDIO.id)).toBe("")
	})

	it("forgets a dropped space that is not open and keeps the selection", async () => {
		const gear = await withStudio()
		await gear.joined.admit(STUDIO, HOST_EMAIL)
		gear.joined.selectSpace(gear.home.id)

		gear.wire.hold([])
		gear.wire.announce()
		await settle()

		expect(gear.spaces.getState().selectedSpaceId).toBe(gear.home.id)
		expect(gear.hosts.forget).toHaveBeenCalledWith(STUDIO.id)
		expect(gear.joined.hostEmailOf(STUDIO.id)).toBe("")
	})

	it("keeps a space held as removed on screen through the read", async () => {
		const gear = await withStudio()
		await gear.joined.admit(STUDIO, HOST_EMAIL)
		gear.wire.evict(STUDIO)
		await settle()

		expect(gear.spaces.getState().selectedSpaceId).toBe("studio")
		expect(gear.joined.getState().removed?.joined).toEqual(STUDIO)
		expect(gear.hosts.forget).not.toHaveBeenCalled()
	})
})

const HOST_PERSONAL: JoinedSpace = {
	id: "joined-personal",
	hostUrl: "http://192.168.1.22:45367",
	remoteSpaceId: "personal",
	name: "Personal",
}

const HOST_PERSONAL_ROW = "joined:joined-personal"

describe("a local and a joined space both carrying the id personal", () => {
	const withBothPersonals = async () => {
		const gear = await gearFor([HOST_PERSONAL])
		gear.joined.watch()
		await settle()
		return gear
	}

	const switcherOf = (gear: Awaited<ReturnType<typeof withBothPersonals>>) => {
		const shown = shownJoinedSpacesOf(gear.joined.getState())
		return {
			rowIds: switcherSpacesOf(gear.spaces.getState().spaces, shown).map(
				(row) => row.id,
			),
			checked: openRowIdOf(
				gear.joined.getState(),
				gear.spaces.getState().selectedSpaceId,
			),
			marks: remoteMarksOf(shown, gear.hosts.getState().connections),
		}
	}

	it("checks the joined row only and marks it alone while it is open", async () => {
		const gear = await withBothPersonals()

		gear.joined.selectSpace(HOST_PERSONAL_ROW)

		const switcher = switcherOf(gear)
		expect(switcher.rowIds).toContain("personal")
		expect(switcher.rowIds).toContain(HOST_PERSONAL_ROW)
		expect(switcher.checked).toBe(HOST_PERSONAL_ROW)
		expect(Object.keys(switcher.marks)).toEqual([HOST_PERSONAL_ROW])
		expect(gear.spaces.getState().selectedSpaceId).toBe("personal")
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(HOST_PERSONAL.id)
	})

	it("resolves no local space while the joined one is open", async () => {
		const gear = await withBothPersonals()

		gear.joined.selectSpace(HOST_PERSONAL_ROW)

		expect(
			openLocalSpaceOf(gear.spaces.getState().spaces, switcherOf(gear).checked),
		).toBeUndefined()
	})

	it("resolves the local space once the local one is open", async () => {
		const gear = await withBothPersonals()
		gear.joined.selectSpace(HOST_PERSONAL_ROW)

		gear.joined.selectSpace("personal")

		expect(
			openLocalSpaceOf(gear.spaces.getState().spaces, switcherOf(gear).checked)
				?.id,
		).toBe("personal")
	})

	it("checks the local row only, with no mark, once the local one is open", async () => {
		const gear = await withBothPersonals()
		gear.joined.selectSpace(HOST_PERSONAL_ROW)

		gear.joined.selectSpace("personal")

		const switcher = switcherOf(gear)
		expect(switcher.checked).toBe("personal")
		expect(switcher.marks.personal).toBeUndefined()
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
	})

	it("leaves the joined one and opens the first local space", async () => {
		const gear = await withBothPersonals()
		gear.joined.selectSpace(HOST_PERSONAL_ROW)
		gear.joined.askToLeave()

		await gear.joined.leave(HOST_PERSONAL.id)

		const [firstLocal] = gear.spaces.getState().spaces
		expect(gear.wire.transport.remove).toHaveBeenCalledWith(HOST_PERSONAL.id)
		expect(switcherOf(gear).checked).toBe(firstLocal?.id)
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
	})

	it("reopens the joined one remembered at relaunch", async () => {
		const gear = await gearFor([HOST_PERSONAL])
		gear.joined.restore(HOST_PERSONAL_ROW)

		gear.joined.watch()
		await settle()

		expect(switcherOf(gear).checked).toBe(HOST_PERSONAL_ROW)
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(HOST_PERSONAL.id)
	})

	it("keeps the local one open when it was the one remembered", async () => {
		const gear = await withBothPersonals()
		gear.joined.selectSpace("personal")

		gear.joined.restore("personal")

		expect(switcherOf(gear).checked).toBe("personal")
		expect(gear.hosts.activate).toHaveBeenLastCalledWith(null)
	})
})
