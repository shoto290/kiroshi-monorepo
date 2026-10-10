// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
	type SpaceSettingsReads,
	useServerEnvironmentReads,
	useSpaceSettingsReads,
} from "./use-settings-reads"

import { createConnectionsController } from "../applications/connections-controller"
import { createFakeConnectionPort } from "../applications/fake-connection-port"
import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import { createEnvironmentController } from "../environment/environment-controller"
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

const reloadable = () => ({ open: opener(), reload: opener() })

const panelsOf = () => ({
	applications: { open: opener(), reload: opener() },
	environment: reloadable(),
	servers: reloadable(),
	connections: reloadable(),
})

type Panels = ReturnType<typeof panelsOf>

const readCounts = (panels: Panels) =>
	Object.values(panels).map(
		(panel) => panel.open.mock.calls.length + panel.reload.mock.calls.length,
	)

const mounted = (panels: Panels, isOpen: boolean) =>
	renderHook(
		({ isOpen: opened }: Pick<SpaceSettingsReads, "isOpen">) =>
			useSpaceSettingsReads({ ...panels, spaceId: "personal", isOpen: opened }),
		{ initialProps: { isOpen } },
	)

const serverEnvironmentShown = () => {
	const environment = reloadable()
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

describe("useSpaceSettingsReads on live controllers", () => {
	const SPACE = { kind: "space", id: "personal" } as const
	const ATLAS = { name: "atlas", status: "needsAuthorization" } as const

	const shownWithLiveControllers = async () => {
		const port = createFakeConnectionPort()
		port.rows.space = [ATLAS]
		const connections = createConnectionsController(port)
		const store = createFakeTranscriptStore()
		await store.setEnvironmentVariable(SPACE, "TOKEN", "secret")
		const environment = createEnvironmentController(store)
		const panels = { ...panelsOf(), environment, connections }
		await joinFakeHost(JOINED)
		renderHook(() =>
			useSpaceSettingsReads({ ...panels, spaceId: SPACE.id, isOpen: true }),
		)
		await waitFor(() => expect(connections.getState().rows).toEqual([ATLAS]))
		await waitFor(() => expect(environment.getState().entries).toHaveLength(1))
		return { connections, environment }
	}

	it("keeps a connect in flight when the relay of the joined Space reopens", async () => {
		const { connections } = await shownWithLiveControllers()
		void connections.connect("atlas", "https://mcp.atlas.test/mcp")

		reopenFakeRelay(JOINED)

		expect(connections.getState()).toMatchObject({
			rows: [ATLAS],
			connecting: "atlas",
		})
		void connections.cancel()
	})

	it("keeps the environment rows on screen while the fresh read is on its way", async () => {
		const { environment } = await shownWithLiveControllers()

		reopenFakeRelay(JOINED)

		expect(environment.getState().entries).toHaveLength(1)
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

		expect(environment.reload).toHaveBeenCalledOnce()
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
