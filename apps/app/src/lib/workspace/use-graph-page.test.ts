// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { type GraphExits, useGraphPage } from "./use-graph-page"

const exitsWatched = (): GraphExits => ({
	onSelectBot: vi.fn(),
	onSelectConversation: vi.fn(),
	selectCompanion: vi.fn(),
	openSidebarTab: vi.fn(),
	missionsBySpaceId: {},
})

const openGraph = (exits: GraphExits) => {
	const page = renderHook(() => useGraphPage(exits))
	act(() => page.result.current.toggle?.())
	return page
}

afterEach(cleanup)

describe("the graph page", () => {
	it("closes and shows the companion when a companion is selected", () => {
		const exits = exitsWatched()
		const page = openGraph(exits)
		expect(page.result.current.opened).toBeDefined()

		act(() => page.result.current.exits.selectCompanion("atlas"))

		expect(page.result.current.opened).toBeUndefined()
		expect(exits.selectCompanion).toHaveBeenCalledWith("atlas")
	})

	it("closes when the rail entry is pressed again", () => {
		const page = openGraph(exitsWatched())

		act(() => page.result.current.toggle?.())

		expect(page.result.current.isOpen).toBe(false)
	})
})
