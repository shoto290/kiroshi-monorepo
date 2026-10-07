import { describe, expect, it, vi } from "vitest"

import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import {
	createHostingController,
	type HostingTransport,
} from "./hosting-controller"

import type { HostingChanged, HostingState } from "../bindings"

vi.mock("./index", () => ({ listen: vi.fn(async () => () => undefined) }))

const HOME = { id: "home", name: "Home" }

const OFF: HostingState = { kind: "off" }
const ONLINE: HostingState = { kind: "online" }
const DROPPED: HostingState = { kind: "failed", reason: "relay closed" }

const COULDNT_HOST_HOME: NoticeMessage = {
	title: "Couldn’t host Home",
	description: "Check your connection and turn it on again.",
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const createFakeTransport = (overrides: Partial<HostingTransport> = {}) => {
	const events: { announce: (changed: HostingChanged) => void } = {
		announce: () => undefined,
	}
	const unlisten = vi.fn()
	const transport: HostingTransport = {
		read: vi.fn(async () => OFF),
		start: vi.fn(async () => ONLINE),
		stop: vi.fn(async () => OFF),
		onChanged: vi.fn(async (listener) => {
			events.announce = listener
			return unlisten
		}),
		...overrides,
	}
	return { transport, events, unlisten }
}

const watchHome = async (overrides: Partial<HostingTransport> = {}) => {
	const fake = createFakeTransport(overrides)
	const reportFailure = vi.fn<(message: NoticeMessage) => void>()
	const controller = createHostingController({
		transport: fake.transport,
		reportFailure,
	})
	const unwatch = controller.watch(HOME)
	await settle()
	return { ...fake, controller, reportFailure, unwatch }
}

describe("createHostingController", () => {
	it("reads the state of the watched space", async () => {
		const { controller, transport } = await watchHome({
			read: vi.fn(async () => ONLINE),
		})

		expect(transport.read).toHaveBeenCalledWith(HOME.id)
		expect(controller.getState().hosting).toEqual(ONLINE)
	})

	it("follows the changes of the watched space and ignores the others", async () => {
		const { controller, events } = await watchHome()

		events.announce({ spaceId: "garage", state: ONLINE })
		expect(controller.getState().hosting).toEqual(OFF)

		events.announce({ spaceId: HOME.id, state: { kind: "connecting" } })
		expect(controller.getState().hosting).toEqual({ kind: "connecting" })
	})

	it("starts and stops the watched space and keeps the state each returns", async () => {
		const { controller, transport } = await watchHome()

		controller.start()
		await settle()
		expect(transport.start).toHaveBeenCalledWith(HOME.id)
		expect(controller.getState().hosting).toEqual(ONLINE)

		controller.stop()
		await settle()
		expect(transport.stop).toHaveBeenCalledWith(HOME.id)
		expect(controller.getState().hosting).toEqual(OFF)
	})

	it("raises one H6 notice naming the space, without the raw reason, when hosting fails", async () => {
		const { events, reportFailure } = await watchHome()

		events.announce({ spaceId: HOME.id, state: DROPPED })
		events.announce({ spaceId: HOME.id, state: DROPPED })

		expect(reportFailure).toHaveBeenCalledOnce()
		expect(reportFailure).toHaveBeenCalledWith(COULDNT_HOST_HOME)
	})

	it("returns the switch to off with the H6 notice when the start rejects", async () => {
		const { controller, reportFailure } = await watchHome({
			start: vi.fn(async () => {
				throw new Error("relay refused the token")
			}),
		})

		controller.start()
		await settle()

		expect(controller.getState().hosting).toEqual(OFF)
		expect(reportFailure).toHaveBeenCalledExactlyOnceWith(COULDNT_HOST_HOME)
	})

	it("keeps the switch on and raises the stop notice when the stop rejects", async () => {
		const { controller, reportFailure } = await watchHome({
			read: vi.fn(async () => ONLINE),
			stop: vi.fn(async () => {
				throw new Error("unreachable")
			}),
		})

		controller.stop()
		await settle()

		expect(controller.getState().hosting).toEqual(ONLINE)
		expect(reportFailure).toHaveBeenCalledExactlyOnceWith({
			title: "Couldn’t stop hosting Home",
			description: "Turn it off again.",
		})
	})

	it("raises a notice when the read rejects", async () => {
		const { controller, reportFailure } = await watchHome({
			read: vi.fn(async () => {
				throw new Error("unreachable")
			}),
		})

		expect(controller.getState().hosting).toBeUndefined()
		expect(reportFailure).toHaveBeenCalledOnce()
	})

	it("stops following the space once unwatched", async () => {
		const { controller, events, unwatch, unlisten } = await watchHome()

		unwatch()
		await settle()
		events.announce({ spaceId: HOME.id, state: ONLINE })

		expect(unlisten).toHaveBeenCalledOnce()
		expect(controller.getState().hosting).toEqual(OFF)
	})

	it("raises one more notice when a retry from failed ends in failed again", async () => {
		const { controller, events, reportFailure } = await watchHome({
			start: vi.fn(async () => DROPPED),
		})
		events.announce({ spaceId: HOME.id, state: DROPPED })

		controller.start()
		await settle()
		events.announce({ spaceId: HOME.id, state: DROPPED })

		expect(reportFailure).toHaveBeenCalledTimes(2)
		expect(controller.getState().hosting).toEqual(DROPPED)
	})

	it("raises one notice when the event lands before the failed answer of the same start", async () => {
		let answer: (hosting: HostingState) => void = () => undefined
		const { controller, events, reportFailure } = await watchHome({
			start: vi.fn(
				() =>
					new Promise<HostingState>((resolve) => {
						answer = resolve
					}),
			),
		})

		controller.start()
		events.announce({ spaceId: HOME.id, state: DROPPED })
		answer(DROPPED)
		await settle()

		expect(reportFailure).toHaveBeenCalledExactlyOnceWith(COULDNT_HOST_HOME)
	})

	it("raises one notice when the failed answer lands before the event of the same start", async () => {
		const { controller, events, reportFailure } = await watchHome({
			start: vi.fn(async () => DROPPED),
		})

		controller.start()
		await settle()
		events.announce({ spaceId: HOME.id, state: DROPPED })

		expect(reportFailure).toHaveBeenCalledExactlyOnceWith(COULDNT_HOST_HOME)
	})

	it("keeps a state an event settled before the initial read resolves", async () => {
		let answer: (hosting: HostingState) => void = () => undefined
		const { controller, events } = await watchHome({
			read: vi.fn(
				() =>
					new Promise<HostingState>((resolve) => {
						answer = resolve
					}),
			),
		})

		events.announce({ spaceId: HOME.id, state: ONLINE })
		answer(OFF)
		await settle()

		expect(controller.getState().hosting).toEqual(ONLINE)
	})

	it("raises no notice when the same failed space is reopened", async () => {
		const { controller, events, reportFailure, transport, unwatch } =
			await watchHome()
		events.announce({ spaceId: HOME.id, state: DROPPED })
		unwatch()
		vi.mocked(transport.read).mockResolvedValue(DROPPED)

		controller.watch(HOME)
		await settle()

		expect(reportFailure).toHaveBeenCalledOnce()
	})
})
