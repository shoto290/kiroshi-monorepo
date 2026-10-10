// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
	type SpaceSettingsReads,
	useServerEnvironmentReads,
	useSpaceSettingsReads,
} from "./use-settings-reads"

import {
	joinFakeHost,
	leaveFakeHost,
	reopenFakeRelay,
} from "../host/fake-joined-hosts"

vi.mock("../host", async (importOriginal) => ({
	...(await importOriginal<typeof import("../host")>()),
	...(await import("../host/fake-joined-hosts")).fakeHostModule,
}))

const JOINED = "garage"

const SERVER = {
	kind: "server",
	name: "linear",
	owner: { kind: "space", id: "personal" },
} as const

afterEach(async () => {
	cleanup()
	await leaveFakeHost(JOINED)
})

const opener = () => vi.fn(() => Promise.resolve())

const panelsOf = () => ({
	applications: { open: opener() },
	environment: { open: opener() },
	servers: { open: opener() },
	connections: { open: opener() },
})

type Panels = ReturnType<typeof panelsOf>

const readCounts = (panels: Panels) =>
	Object.values(panels).map((panel) => panel.open.mock.calls.length)

const mounted = (panels: Panels, isOpen: boolean) =>
	renderHook(
		({ isOpen: opened }: Pick<SpaceSettingsReads, "isOpen">) =>
			useSpaceSettingsReads({ ...panels, spaceId: "personal", isOpen: opened }),
		{ initialProps: { isOpen } },
	)

const serverEnvironmentShown = () => {
	const environment = { open: opener() }
	const rendered = renderHook(() =>
		useServerEnvironmentReads({ environment, server: SERVER }),
	)
	return { environment, rendered }
}

describe("useSpaceSettingsReads", () => {
	it("reads every Space panel when the settings dialog opens", () => {
		const panels = panelsOf()

		mounted(panels, true)

		expect(readCounts(panels)).toEqual([1, 1, 1, 1])
		expect(panels.servers.open).toHaveBeenCalledWith({
			kind: "space",
			id: "personal",
		})
	})

	it("reads none of them while the settings dialog is closed", () => {
		const panels = panelsOf()

		mounted(panels, false)

		expect(readCounts(panels)).toEqual([0, 0, 0, 0])
	})

	it("reads them again when the relay of the joined Space reopens", async () => {
		const panels = panelsOf()
		await joinFakeHost(JOINED)
		mounted(panels, true)

		reopenFakeRelay(JOINED)

		expect(readCounts(panels)).toEqual([2, 2, 2, 2])
	})

	it("reads nothing more when the relay of another Space reopens", async () => {
		const panels = panelsOf()
		await joinFakeHost(JOINED)
		mounted(panels, true)

		reopenFakeRelay("attic")

		expect(readCounts(panels)).toEqual([1, 1, 1, 1])
	})

	it("reads nothing more once the settings dialog has closed", async () => {
		const panels = panelsOf()
		await joinFakeHost(JOINED)
		const rendered = mounted(panels, true)
		rendered.rerender({ isOpen: false })

		reopenFakeRelay(JOINED)

		expect(readCounts(panels)).toEqual([1, 1, 1, 1])
	})
})

describe("useServerEnvironmentReads", () => {
	it("reads the environment of the opened server", () => {
		const { environment } = serverEnvironmentShown()

		expect(environment.open).toHaveBeenCalledExactlyOnceWith(SERVER)
	})

	it("reads it again when the relay of the joined Space reopens", async () => {
		await joinFakeHost(JOINED)
		const { environment } = serverEnvironmentShown()

		reopenFakeRelay(JOINED)

		expect(environment.open).toHaveBeenCalledTimes(2)
	})

	it("reads nothing more when the relay of another Space reopens", async () => {
		await joinFakeHost(JOINED)
		const { environment } = serverEnvironmentShown()

		reopenFakeRelay("attic")

		expect(environment.open).toHaveBeenCalledOnce()
	})

	it("reads nothing more once the panel is gone", async () => {
		await joinFakeHost(JOINED)
		const { environment, rendered } = serverEnvironmentShown()
		rendered.unmount()

		reopenFakeRelay(JOINED)

		expect(environment.open).toHaveBeenCalledOnce()
	})
})
