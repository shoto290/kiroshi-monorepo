// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { HostedSpace } from "./hosting-controller"
import { isDesktopHost, listen } from "./index"
import { useHosting } from "./use-hosting"

import {
	commands,
	HOSTING_CHANGED_EVENT,
	type HostingChanged,
	type HostingState,
} from "../bindings"

vi.mock("./index", () => ({
	isDesktopHost: vi.fn(),
	listen: vi.fn(),
}))

vi.mock("../bindings", async (importOriginal) => ({
	...(await importOriginal<typeof import("../bindings")>()),
	commands: {
		hostingState: vi.fn(),
		hostingStart: vi.fn(),
		hostingStop: vi.fn(),
	},
}))

type ChangedHandler = (event: { payload: HostingChanged }) => void

const events: { announce: ChangedHandler } = { announce: () => undefined }
const unlisten = vi.fn()

const HOME: HostedSpace = { id: "home", name: "Home" }

const renderHosting = (openSpace: HostedSpace | null) =>
	renderHook(({ openSpace }) => useHosting(openSpace), {
		initialProps: { openSpace },
	})

const announce = (spaceId: string, state: HostingState) =>
	act(async () => events.announce({ payload: { spaceId, state } }))

beforeEach(() => {
	vi.mocked(isDesktopHost).mockReturnValue(true)
	vi.mocked(commands.hostingState).mockResolvedValue({ kind: "off" })
	vi.mocked(commands.hostingStart).mockResolvedValue({
		status: "ok",
		data: { kind: "connecting" },
	})
	vi.mocked(commands.hostingStop).mockResolvedValue({
		status: "ok",
		data: { kind: "off" },
	})
	vi.mocked(listen).mockImplementation(async (event, handler) => {
		if (event === HOSTING_CHANGED_EVENT) {
			events.announce = handler as unknown as ChangedHandler
		}
		return unlisten
	})
})

afterEach(async () => {
	cleanup()
	await new Promise((resolve) => setTimeout(resolve, 0))
	vi.clearAllMocks()
})

describe("useHosting", () => {
	it("passes the hosting of the open space once read", async () => {
		const { result } = renderHosting(HOME)

		await act(async () => undefined)

		expect(commands.hostingState).toHaveBeenCalledWith(HOME.id)
		expect(result.current?.hosting).toBe("off")
	})

	it.each([
		[{ kind: "off" }, "off"],
		[{ kind: "connecting" }, "connecting"],
		[{ kind: "online" }, "online"],
		[{ kind: "needsSignIn" }, "signed-out"],
		[{ kind: "failed", reason: "relay closed" }, "off"],
	] as const)("maps %o to %s", async (state, hosting) => {
		const { result } = renderHosting(HOME)
		await act(async () => undefined)

		await announce(HOME.id, state)

		expect(result.current?.hosting).toBe(hosting)
	})

	it("renders the state hostingStart returns once the person hosts", async () => {
		const { result } = renderHosting(HOME)
		await act(async () => undefined)

		await act(async () => result.current?.onHost())

		expect(commands.hostingStart).toHaveBeenCalledWith(HOME.id)
		expect(result.current?.hosting).toBe("connecting")
	})

	it("keeps the state when hostingStop answers an error", async () => {
		vi.mocked(commands.hostingState).mockResolvedValue({ kind: "online" })
		vi.mocked(commands.hostingStop).mockResolvedValue({
			status: "error",
			error: { kind: "notFound" } as never,
		})
		const { result } = renderHosting(HOME)
		await act(async () => undefined)

		await act(async () => result.current?.onStopHosting())

		expect(result.current?.hosting).toBe("online")
	})

	it("follows the next space and drops the listener of the previous one", async () => {
		const { rerender, result } = renderHosting(HOME)
		await act(async () => undefined)

		rerender({ openSpace: { id: "garage", name: "Garage" } })
		await act(async () => undefined)
		await announce(HOME.id, { kind: "online" })

		expect(commands.hostingState).toHaveBeenLastCalledWith("garage")
		expect(unlisten).toHaveBeenCalledOnce()
		expect(result.current?.hosting).toBe("off")
	})

	it("drops the listener when the dialog closes", async () => {
		const { rerender } = renderHosting(HOME)
		await act(async () => undefined)

		rerender({ openSpace: null })
		await act(async () => undefined)

		expect(unlisten).toHaveBeenCalledOnce()
	})

	it("passes nothing outside the desktop window and reads nothing", async () => {
		vi.mocked(isDesktopHost).mockReturnValue(false)
		const { result } = renderHosting(HOME)

		await act(async () => undefined)

		expect(result.current).toBeUndefined()
		expect(commands.hostingState).not.toHaveBeenCalled()
		expect(listen).not.toHaveBeenCalled()
	})
})
