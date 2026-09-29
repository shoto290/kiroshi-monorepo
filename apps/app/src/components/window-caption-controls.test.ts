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
import { MissionHeader } from "@workspace/ui/components/mission-header"
import { NoticeSurface } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import {
	titleBarDragRegion,
	titleBarWindowControls,
} from "@/components/window-caption-controls"
import type { MaximizeButtonState } from "@/lib/bindings"
import {
	closeWindow,
	declareMaximizeButton,
	hasCaptionWindowControls,
	type MaximizedWatch,
	minimizeWindow,
	toggleMaximizeWindow,
	watchMaximizeButton,
	watchWindowFocus,
	watchWindowMaximized,
} from "@/lib/host"

vi.mock("@/lib/host", () => ({
	hasCaptionWindowControls: vi.fn(),
	minimizeWindow: vi.fn(),
	toggleMaximizeWindow: vi.fn(),
	closeWindow: vi.fn(),
	watchWindowMaximized: vi.fn(),
	declareMaximizeButton: vi.fn(),
	watchMaximizeButton: vi.fn(),
	watchWindowFocus: vi.fn(),
}))

const stopWatching = vi.fn()
const stopFollowingPointer = vi.fn()
const stopFollowingFocus = vi.fn()
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

const renderMissionHeader = () =>
	render(
		createElement(MissionHeader, {
			bot: { name: "Ada Martin", seed: "bot-ada-martin" },
			objective: "Ship the title bar",
			ticket: {
				externalId: "OPE-438",
				title: "Window controls",
				platform: "linear",
				url: "https://linear.example/OPE-438",
			},
			tools: [],
			state: "waiting_human",
			isWorking: false,
			openedAt: 0,
			now: 0,
			onBack: vi.fn(),
			dragRegion: titleBarDragRegion(),
			windowControls: titleBarWindowControls(),
		}),
	)

const isDragBlocking = (element: HTMLElement) =>
	element.tagName === "BUTTON" &&
	!element.hasAttribute("data-tauri-drag-region")

const reportedMaximized = (isMaximized: boolean) => {
	const [watch] = vi.mocked(watchWindowMaximized).mock.calls.at(-1) as [
		MaximizedWatch,
	]
	act(() => watch.report(isMaximized))
}

const reportedPointer = (state: MaximizeButtonState) => {
	const [report] = vi
		.mocked(watchMaximizeButton)
		.mock.calls.at(-1) as Parameters<typeof watchMaximizeButton>
	act(() => report(state))
}

const reportedFocus = (isFocused: boolean) => {
	const [report] = vi.mocked(watchWindowFocus).mock.calls.at(-1) as Parameters<
		typeof watchWindowFocus
	>
	act(() => report(isFocused))
}

const MAXIMIZE_STATES: MaximizeButtonState[] = ["idle", "hover", "pressed"]

const carriesState: Record<
	MaximizeButtonState,
	(classes: DOMTokenList) => boolean
> = {
	idle: (classes) => classes.contains("hover:bg-transparent"),
	hover: (classes) =>
		classes.contains("bg-muted") && !classes.contains("scale-100"),
	pressed: (classes) => classes.contains("scale-100"),
}

const maximizeShows = (state: MaximizeButtonState) => {
	const { classList } = screen.getByRole("button", { name: "Maximize" })
	return MAXIMIZE_STATES.every(
		(candidate) => carriesState[candidate](classList) === (candidate === state),
	)
}

const POINTER_FAILURE =
	"The maximize button can’t show hover or press feedback."

beforeEach(() => {
	resizeObservers = []
	vi.stubGlobal("ResizeObserver", FakeResizeObserver)
	vi.mocked(hasCaptionWindowControls).mockReturnValue(true)
	vi.mocked(minimizeWindow).mockResolvedValue()
	vi.mocked(toggleMaximizeWindow).mockResolvedValue()
	vi.mocked(closeWindow).mockResolvedValue()
	vi.mocked(declareMaximizeButton).mockResolvedValue()
	vi.mocked(watchWindowMaximized).mockResolvedValue(stopWatching)
	vi.mocked(watchMaximizeButton).mockResolvedValue(stopFollowingPointer)
	vi.mocked(watchWindowFocus).mockResolvedValue(stopFollowingFocus)
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

	it("forces the maximize button into the state the host reports", () => {
		renderHeader()
		expect(maximizeShows("idle")).toBe(true)

		reportedPointer("hover")
		expect(maximizeShows("hover")).toBe(true)

		reportedPointer("pressed")
		expect(maximizeShows("pressed")).toBe(true)

		reportedPointer("idle")
		expect(maximizeShows("idle")).toBe(true)
	})

	it("returns the maximize button to idle when the window loses focus", () => {
		renderHeader()
		reportedPointer("hover")
		expect(maximizeShows("hover")).toBe(true)

		reportedFocus(true)
		expect(maximizeShows("hover")).toBe(true)

		reportedFocus(false)
		expect(maximizeShows("idle")).toBe(true)
	})

	it("subscribes to the maximize button once per mount", () => {
		renderHeader()
		reportedPointer("hover")
		reportedPointer("pressed")

		expect(watchMaximizeButton).toHaveBeenCalledOnce()
		expect(watchWindowFocus).toHaveBeenCalledOnce()
	})

	it("stops following the maximize button once unmounted", async () => {
		const { unmount } = renderHeader()

		unmount()

		await waitFor(() => {
			expect(stopFollowingPointer).toHaveBeenCalledOnce()
			expect(stopFollowingFocus).toHaveBeenCalledOnce()
		})
	})

	it("follows no maximize button off Windows", () => {
		vi.mocked(hasCaptionWindowControls).mockReturnValue(false)
		renderHeader()

		expect(watchMaximizeButton).not.toHaveBeenCalled()
		expect(watchWindowFocus).not.toHaveBeenCalled()
	})

	it("names the maximize button events it could not follow and stays idle", async () => {
		vi.mocked(watchMaximizeButton).mockRejectedValue(new Error("denied"))
		renderHeader()

		expect(await screen.findAllByText(POINTER_FAILURE)).toBeTruthy()
		expect(maximizeShows("idle")).toBe(true)
	})

	it("names the focus changes it could not follow and ignores later reports", async () => {
		vi.mocked(watchWindowFocus).mockRejectedValue(new Error("denied"))
		renderHeader()

		expect(await screen.findAllByText(POINTER_FAILURE)).toBeTruthy()
		reportedPointer("hover")
		expect(maximizeShows("idle")).toBe(true)
	})

	it("drags the window from the mission header on Windows", () => {
		renderMissionHeader()
		const header = screen.getByRole("banner")
		const buttons = [
			"Back to the conversation",
			"Minimize",
			"Maximize",
			"Close",
		]

		expect(header.getAttribute("data-tauri-drag-region")).toBe("deep")
		for (const name of buttons) {
			expect(isDragBlocking(screen.getByRole("button", { name }))).toBe(true)
		}
	})

	it("leaves the mission header without a drag region off Windows", () => {
		vi.mocked(hasCaptionWindowControls).mockReturnValue(false)
		renderMissionHeader()

		expect(
			screen.getByRole("banner").hasAttribute("data-tauri-drag-region"),
		).toBe(false)
	})
})
