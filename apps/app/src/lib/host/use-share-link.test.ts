// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isDesktopHost, listen } from "./index"
import { useShareLink } from "./use-share-link"

import { commands, HOST_PRESENCE_EVENT, type HostPresence } from "../bindings"

vi.mock("./index", () => ({
	isDesktopHost: vi.fn(),
	listen: vi.fn(),
}))

vi.mock("../bindings", async (importOriginal) => ({
	...(await importOriginal<typeof import("../bindings")>()),
	commands: { hostShareLink: vi.fn() },
}))

const LINK = "kiroshi://join/host.local:4242?token=secret"

type PresenceHandler = (event: { payload: HostPresence }) => void

const presence: { announce: PresenceHandler } = { announce: () => undefined }
const unlisten = vi.fn()

const SPACE_ID = "s1"

const renderShareLink = (openSpaceId: string | null) =>
	renderHook(({ openSpaceId }) => useShareLink(openSpaceId), {
		initialProps: { openSpaceId },
	})

beforeEach(() => {
	vi.mocked(isDesktopHost).mockReturnValue(true)
	vi.mocked(commands.hostShareLink).mockResolvedValue({
		status: "ok",
		data: { kind: "up", link: LINK },
	})
	vi.mocked(listen).mockImplementation(async (event, handler) => {
		if (event === HOST_PRESENCE_EVENT) {
			presence.announce = handler as unknown as PresenceHandler
		}
		return unlisten
	})
})

afterEach(async () => {
	cleanup()
	await new Promise((resolve) => setTimeout(resolve, 0))
	vi.clearAllMocks()
})

describe("useShareLink", () => {
	it("reads the link of the open space when the dialog opens in the desktop window", async () => {
		const { result } = renderShareLink(SPACE_ID)

		await act(async () => undefined)

		expect(commands.hostShareLink).toHaveBeenCalledWith(SPACE_ID)
		expect(result.current).toBe(LINK)
	})

	it("passes null while the host is down", async () => {
		vi.mocked(commands.hostShareLink).mockResolvedValue({
			status: "ok",
			data: { kind: "down" },
		})
		const { result } = renderShareLink(SPACE_ID)

		await act(async () => undefined)

		expect(result.current).toBeNull()
	})

	it("reads again on a presence change without taking the link from the payload", async () => {
		vi.mocked(commands.hostShareLink).mockResolvedValueOnce({
			status: "ok",
			data: { kind: "down" },
		})
		const { result } = renderShareLink(SPACE_ID)
		await act(async () => undefined)

		await act(async () => presence.announce({ payload: { isUp: false } }))

		expect(commands.hostShareLink).toHaveBeenCalledTimes(2)
		expect(result.current).toBe(LINK)
	})

	it("subscribes once per mount across re-renders", async () => {
		const { rerender } = renderShareLink(SPACE_ID)
		await act(async () => undefined)

		rerender({ openSpaceId: SPACE_ID })
		rerender({ openSpaceId: SPACE_ID })
		await act(async () => undefined)

		expect(listen).toHaveBeenCalledOnce()
	})

	it("reads the link of the next space when the open space changes", async () => {
		const { rerender } = renderShareLink(SPACE_ID)
		await act(async () => undefined)

		rerender({ openSpaceId: "s2" })
		await act(async () => undefined)

		expect(commands.hostShareLink).toHaveBeenLastCalledWith("s2")
		expect(unlisten).toHaveBeenCalledOnce()
	})

	it("removes the presence listener when the dialog unmounts", async () => {
		const { unmount } = renderShareLink(SPACE_ID)
		await act(async () => undefined)

		unmount()
		await act(async () => undefined)

		expect(unlisten).toHaveBeenCalledOnce()
	})

	it("passes undefined outside the desktop window and reads nothing", async () => {
		vi.mocked(isDesktopHost).mockReturnValue(false)
		const { result } = renderShareLink(SPACE_ID)

		await act(async () => undefined)

		expect(result.current).toBeUndefined()
		expect(commands.hostShareLink).not.toHaveBeenCalled()
		expect(listen).not.toHaveBeenCalled()
	})

	it("reads nothing while the dialog is closed", async () => {
		renderShareLink(null)

		await act(async () => undefined)

		expect(commands.hostShareLink).not.toHaveBeenCalled()
	})
})
