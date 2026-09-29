// @vitest-environment happy-dom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppHeader } from "@workspace/ui/components/app-header"
import { NoticeSurface } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import { titleBarWindowControls } from "@/components/window-caption-controls"
import {
	closeWindow,
	declareMaximizeButton,
	hasCaptionWindowControls,
	type MaximizedWatch,
	minimizeWindow,
	toggleMaximizeWindow,
	watchWindowMaximized,
} from "@/lib/host"

vi.mock("@/lib/host", () => ({
	hasCaptionWindowControls: vi.fn(),
	minimizeWindow: vi.fn(),
	toggleMaximizeWindow: vi.fn(),
	closeWindow: vi.fn(),
	watchWindowMaximized: vi.fn(),
	declareMaximizeButton: vi.fn(),
}))

const stopWatching = vi.fn()
let resizeObservers: Array<() => void> = []

class FakeResizeObserver {
	constructor(private readonly callback: () => void) {}
	observe = () => {
		resizeObservers.push(this.callback)
		this.callback()
	}
	disconnect = () => {
		resizeObservers = resizeObservers.filter(
			(callback) => callback !== this.callback,
		)
	}
}

const renderHeader = () => {
	render(createElement(NoticeSurface))
	return render(
		createElement(AppHeader, {
			trailing: "Pinned",
			windowControls: titleBarWindowControls(),
		}),
	)
}

const reportedMaximized = (isMaximized: boolean) => {
	const [watch] = vi.mocked(watchWindowMaximized).mock.calls.at(-1) as [
		MaximizedWatch,
	]
	act(() => watch.report(isMaximized))
}

beforeEach(() => {
	resizeObservers = []
	vi.stubGlobal("ResizeObserver", FakeResizeObserver)
	vi.mocked(hasCaptionWindowControls).mockReturnValue(true)
	vi.mocked(minimizeWindow).mockResolvedValue()
	vi.mocked(toggleMaximizeWindow).mockResolvedValue()
	vi.mocked(closeWindow).mockResolvedValue()
	vi.mocked(declareMaximizeButton).mockResolvedValue()
	vi.mocked(watchWindowMaximized).mockResolvedValue(stopWatching)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.unstubAllGlobals()
})

describe("title bar window controls", () => {
	it("renders no caption buttons off Windows", () => {
		vi.mocked(hasCaptionWindowControls).mockReturnValue(false)
		renderHeader()

		expect(screen.queryByRole("button", { name: "Minimize" })).toBeNull()
		expect(
			screen.getByRole("banner").querySelector("[data-slot*=window]"),
		).toBeNull()
	})

	it("renders the caption buttons after the trailing slot", () => {
		renderHeader()
		const header = screen.getByRole("banner")

		expect(header.lastElementChild?.textContent).toBe("")
		expect(header.lastElementChild?.querySelectorAll("button")).toHaveLength(3)
	})

	it("drives the current window from each button", () => {
		renderHeader()

		fireEvent.click(screen.getByRole("button", { name: "Minimize" }))
		fireEvent.click(screen.getByRole("button", { name: "Maximize" }))
		fireEvent.click(screen.getByRole("button", { name: "Close" }))

		expect(minimizeWindow).toHaveBeenCalledOnce()
		expect(toggleMaximizeWindow).toHaveBeenCalledOnce()
		expect(closeWindow).toHaveBeenCalledOnce()
	})

	it("follows the window between maximized and restored", () => {
		renderHeader()

		reportedMaximized(true)
		expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy()

		reportedMaximized(false)
		expect(screen.getByRole("button", { name: "Maximize" })).toBeTruthy()
	})

	it("stops following the window once unmounted", async () => {
		const { unmount } = renderHeader()
		await waitFor(() => expect(watchWindowMaximized).toHaveBeenCalled())

		unmount()

		await waitFor(() => expect(stopWatching).toHaveBeenCalledOnce())
	})

	it("declares the maximize button while mounted and withdraws it on unmount", () => {
		const { unmount } = renderHeader()
		const declared = vi.mocked(declareMaximizeButton)

		expect(declared).toHaveBeenLastCalledWith(
			expect.objectContaining({ width: expect.any(Number) }),
		)

		fireEvent(window, new Event("resize"))
		for (const observed of resizeObservers) observed()
		expect(declared).toHaveBeenCalledTimes(3)

		unmount()
		expect(declared).toHaveBeenLastCalledWith(null)
	})

	it("names the window action that failed", async () => {
		vi.mocked(minimizeWindow).mockRejectedValue(new Error("denied"))
		renderHeader()

		fireEvent.click(screen.getByRole("button", { name: "Minimize" }))

		expect(
			await screen.findAllByText("Couldn’t minimize Kiroshi."),
		).toBeTruthy()
	})

	it("names the maximize button declaration once when it keeps failing", async () => {
		vi.mocked(declareMaximizeButton).mockRejectedValue(new Error("unsupported"))
		renderHeader()
		const snapNotices = () =>
			screen.findAllByText(
				"Snap layouts are unavailable on the maximize button.",
			)
		const firstCount = (await snapNotices()).length

		fireEvent(window, new Event("resize"))
		fireEvent(window, new Event("resize"))
		await act(() => Promise.resolve())

		expect(await snapNotices()).toHaveLength(firstCount)
	})

	it("names the maximized state it could not read", async () => {
		vi.mocked(watchWindowMaximized).mockRejectedValue(new Error("denied"))
		renderHeader()

		expect(
			await screen.findAllByText("Couldn’t tell whether Kiroshi is maximized."),
		).toBeTruthy()
	})
})
