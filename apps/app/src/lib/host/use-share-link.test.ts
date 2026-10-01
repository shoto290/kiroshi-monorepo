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

const renderShareLink = (isOpen: boolean) =>
	renderHook(({ isOpen }) => useShareLink(isOpen), {
		initialProps: { isOpen },
	})

beforeEach(() => {
	vi.mocked(isDesktopHost).mockReturnValue(true)
	vi.mocked(commands.hostShareLink).mockResolvedValue({
		kind: "up",
		link: LINK,
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
	it("reads the link when the dialog opens in the desktop window", async () => {
		const { result } = renderShareLink(true)

		await act(async () => undefined)

		expect(result.current).toBe(LINK)
	})

	it("passes null while the host is down", async () => {
		vi.mocked(commands.hostShareLink).mockResolvedValue({ kind: "down" })
		const { result } = renderShareLink(true)

		await act(async () => undefined)

		expect(result.current).toBeNull()
	})

	it("reads again on a presence change without taking the link from the payload", async () => {
		vi.mocked(commands.hostShareLink).mockResolvedValueOnce({ kind: "down" })
		const { result } = renderShareLink(true)
		await act(async () => undefined)

		await act(async () => presence.announce({ payload: { isUp: false } }))

		expect(commands.hostShareLink).toHaveBeenCalledTimes(2)
		expect(result.current).toBe(LINK)
	})

	it("subscribes once per mount across re-renders", async () => {
		const { rerender } = renderShareLink(true)
		await act(async () => undefined)

		rerender({ isOpen: true })
		rerender({ isOpen: true })
		await act(async () => undefined)

		expect(listen).toHaveBeenCalledOnce()
	})

	it("removes the presence listener when the dialog unmounts", async () => {
		const { unmount } = renderShareLink(true)
		await act(async () => undefined)

		unmount()
		await act(async () => undefined)

		expect(unlisten).toHaveBeenCalledOnce()
	})

	it("passes undefined outside the desktop window and reads nothing", async () => {
		vi.mocked(isDesktopHost).mockReturnValue(false)
		const { result } = renderShareLink(true)

		await act(async () => undefined)

		expect(result.current).toBeUndefined()
		expect(commands.hostShareLink).not.toHaveBeenCalled()
		expect(listen).not.toHaveBeenCalled()
	})

	it("reads nothing while the dialog is closed", async () => {
		renderShareLink(false)

		await act(async () => undefined)

		expect(commands.hostShareLink).not.toHaveBeenCalled()
	})
})
