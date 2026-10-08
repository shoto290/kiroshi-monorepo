import { describe, expect, it, vi } from "vitest"

import {
	createInvitationsController,
	type InvitationsTransport,
	invitationRowsOf,
} from "./invitations-controller"

import type { Invitation, InvitationError, JoinedSpace } from "../bindings"

const STUDIO: Invitation = {
	instanceId: "instance-studio",
	instanceName: "Studio Nord",
	inviterEmail: "lea@example.com",
	invitedAt: "2026-10-08T09:00:00Z",
}

const JOINED_STUDIO: JoinedSpace = {
	id: "joined-studio",
	hostUrl: "wss://cloud.kiroshi.test/instances/instance-studio/relay/member",
	remoteSpaceId: null,
	name: "Studio Nord",
}

const WAITING_ROW = {
	id: STUDIO.instanceId,
	name: "Studio Nord",
	hostEmail: "lea@example.com",
	state: "waiting",
}

const OFFLINE: InvitationError = { kind: "offline", reason: "no route" }

const SERVERS: InvitationError = {
	kind: "serversUnreachable",
	reason: "timed out",
}

const STORAGE: InvitationError = { kind: "storage", detail: "disk full" }

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const transportFake = (listed: Invitation[]) => {
	let announce: (invitations: Invitation[]) => void = () => undefined
	const transport = {
		list: vi.fn(async () => listed),
		accept: vi.fn(async (_id: string) => JOINED_STUDIO),
		decline: vi.fn(async (_id: string) => undefined),
		onChanged: vi.fn(async (listener: (invitations: Invitation[]) => void) => {
			announce = listener
			return () => undefined
		}),
	} satisfies InvitationsTransport
	return {
		transport,
		announce: (invitations: Invitation[]) => announce(invitations),
	}
}

const gearFor = async (listed: Invitation[] = [STUDIO]) => {
	const wire = transportFake(listed)
	const admit = vi.fn(async (_joined: JoinedSpace, _hostEmail: string) => {})
	const reportFailure = vi.fn()
	const invitations = createInvitationsController({
		joinedSpaces: { admit },
		transport: wire.transport,
		reportFailure,
	})
	invitations.watch()
	await settle()
	const rows = () => invitationRowsOf(invitations.getState())
	return { wire, admit, reportFailure, invitations, rows }
}

type Gear = Awaited<ReturnType<typeof gearFor>>

describe("listing invitations", () => {
	it("shows every listed invitation as a waiting row", async () => {
		const gear = await gearFor()

		expect(gear.rows()).toEqual([WAITING_ROW])
	})

	it("refreshes the rows when the invitations change", async () => {
		const gear = await gearFor([])

		gear.wire.announce([STUDIO])

		expect(gear.rows()).toEqual([WAITING_ROW])
	})

	it("shows nothing and reports nothing while signed out", async () => {
		const wire = transportFake([])
		wire.transport.list.mockRejectedValueOnce({ kind: "notSignedIn" })
		const reportFailure = vi.fn()
		const invitations = createInvitationsController({
			joinedSpaces: { admit: vi.fn() },
			transport: wire.transport,
			reportFailure,
		})

		invitations.watch()
		await settle()

		expect(invitationRowsOf(invitations.getState())).toEqual([])
		expect(reportFailure).not.toHaveBeenCalled()
	})
})

describe("accepting an invitation", () => {
	it("shows the row as accepting while the accept runs", async () => {
		const gear = await gearFor()
		gear.wire.transport.accept.mockReturnValueOnce(new Promise(() => {}))

		void gear.invitations.accept(STUDIO.instanceId)

		expect(gear.rows()).toEqual([{ ...WAITING_ROW, state: "accepting" }])
	})

	it("drops the row and hands the joined space over with its inviter", async () => {
		const gear = await gearFor()

		await gear.invitations.accept(STUDIO.instanceId)

		expect(gear.wire.transport.accept).toHaveBeenCalledWith(STUDIO.instanceId)
		expect(gear.rows()).toEqual([])
		expect(gear.admit).toHaveBeenCalledWith(JOINED_STUDIO, "lea@example.com")
	})

	it("keeps an accepting row the refreshed list no longer carries", async () => {
		const gear = await gearFor()
		gear.wire.transport.accept.mockReturnValueOnce(new Promise(() => {}))
		void gear.invitations.accept(STUDIO.instanceId)

		gear.wire.announce([])

		expect(gear.rows()).toEqual([{ ...WAITING_ROW, state: "accepting" }])
	})

	it.each([
		[SERVERS, "servers"],
		[OFFLINE, "offline"],
	])(
		"keeps the row failed on %o and accepts again on Try again",
		async (error, failure) => {
			const gear = await gearFor()
			gear.wire.transport.accept.mockRejectedValueOnce(error)

			await gear.invitations.accept(STUDIO.instanceId)

			expect(gear.rows()).toEqual([
				{ ...WAITING_ROW, state: "failed", failure },
			])
			expect(gear.reportFailure).not.toHaveBeenCalled()

			await gear.invitations.accept(STUDIO.instanceId)

			expect(gear.wire.transport.accept).toHaveBeenCalledTimes(2)
			expect(gear.admit).toHaveBeenCalledWith(JOINED_STUDIO, "lea@example.com")
		},
	)

	it("shows a withdrawn invitation as withdrawn until the list drops it", async () => {
		const gear = await gearFor()
		gear.wire.transport.accept.mockRejectedValueOnce({ kind: "withdrawn" })

		await gear.invitations.accept(STUDIO.instanceId)

		expect(gear.rows()).toEqual([{ ...WAITING_ROW, state: "withdrawn" }])
		expect(gear.admit).not.toHaveBeenCalled()

		gear.wire.announce([])

		expect(gear.rows()).toEqual([])
	})

	it("raises any other failure and keeps the row waiting", async () => {
		const gear = await gearFor()
		gear.wire.transport.accept.mockRejectedValueOnce(STORAGE)

		await gear.invitations.accept(STUDIO.instanceId)

		expect(gear.rows()).toEqual([WAITING_ROW])
		expect(gear.reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "disk full" }),
		)
	})
})

describe("declining an invitation", () => {
	it("declines and removes the row without reporting anything", async () => {
		const gear = await gearFor()

		await gear.invitations.decline(STUDIO.instanceId)

		expect(gear.wire.transport.decline).toHaveBeenCalledWith(STUDIO.instanceId)
		expect(gear.rows()).toEqual([])
		expect(gear.reportFailure).not.toHaveBeenCalled()
	})

	it("raises a failed decline and keeps the row", async () => {
		const gear = await gearFor()
		gear.wire.transport.decline.mockRejectedValueOnce(OFFLINE)

		await gear.invitations.decline(STUDIO.instanceId)

		expect(gear.rows()).toEqual([WAITING_ROW])
		expect(gear.reportFailure).toHaveBeenCalledWith(
			expect.objectContaining({ description: "no route" }),
		)
	})
})

describe("sweeping withdrawn invitations when the switcher closes", () => {
	const HARBOUR: Invitation = {
		instanceId: "instance-harbour",
		instanceName: "Harbour",
		inviterEmail: "sam@example.com",
		invitedAt: "2026-10-08T10:00:00Z",
	}

	const HARBOUR_ROW = {
		id: HARBOUR.instanceId,
		name: "Harbour",
		hostEmail: "sam@example.com",
		state: "waiting",
	}

	const withdrawnGear = async (listed: Invitation[] = [STUDIO]) => {
		const gear = await gearFor(listed)
		gear.wire.transport.accept.mockRejectedValueOnce({ kind: "withdrawn" })
		await gear.invitations.accept(STUDIO.instanceId)
		return gear
	}

	it("removes every withdrawn invitation", async () => {
		const gear = await withdrawnGear()

		gear.invitations.sweepWithdrawn()

		expect(gear.rows()).toEqual([])
	})

	const HARBOUR_STATES: [string, (gear: Gear) => Promise<unknown>][] = [
		["waiting", async () => undefined],
		[
			"accepting",
			async (gear) => {
				gear.wire.transport.accept.mockReturnValueOnce(new Promise(() => {}))
				void gear.invitations.accept(HARBOUR.instanceId)
			},
		],
		[
			"failed",
			async (gear) => {
				gear.wire.transport.accept.mockRejectedValueOnce(OFFLINE)
				await gear.invitations.accept(HARBOUR.instanceId)
			},
		],
	]

	it.each(HARBOUR_STATES)(
		"keeps a %s invitation with its status",
		async (state, reach) => {
			const gear = await withdrawnGear([STUDIO, HARBOUR])
			await reach(gear)
			const harbourRow = gear
				.rows()
				.find((row) => row.id === HARBOUR.instanceId)

			gear.invitations.sweepWithdrawn()

			expect(harbourRow?.state).toBe(state)
			expect(gear.rows()).toEqual([harbourRow])
		},
	)

	it("keeps a swept invitation out when the list still carries it", async () => {
		const gear = await withdrawnGear([STUDIO, HARBOUR])
		gear.invitations.sweepWithdrawn()

		gear.wire.announce([STUDIO, HARBOUR])

		expect(gear.rows()).toEqual([HARBOUR_ROW])
	})

	it("keeps a swept invitation out of a later list read", async () => {
		const gear = await withdrawnGear()
		gear.invitations.sweepWithdrawn()

		gear.invitations.watch()
		await settle()

		expect(gear.wire.transport.list).toHaveBeenCalledTimes(2)
		expect(gear.rows()).toEqual([])
	})

	it("shows a new invitation for the same space as waiting", async () => {
		const gear = await withdrawnGear()
		gear.invitations.sweepWithdrawn()
		gear.wire.announce([])

		gear.wire.announce([{ ...STUDIO, invitedAt: "2026-10-09T09:00:00Z" }])

		expect(gear.rows()).toEqual([WAITING_ROW])
	})
})
