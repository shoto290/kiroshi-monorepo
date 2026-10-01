// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useGraphPage } from "./use-graph-page"

const openGraph = (openSidebarTab = vi.fn()) => {
	const page = renderHook(() => useGraphPage(openSidebarTab))
	act(() => page.result.current.toggle?.())
	return page
}

afterEach(cleanup)

describe("the graph page", () => {
	it("closes when the rail entry is pressed again", () => {
		const page = openGraph()
		expect(page.result.current.isOpen).toBe(true)

		act(() => page.result.current.toggle?.())

		expect(page.result.current.isOpen).toBe(false)
	})

	it("closes on escape", () => {
		const page = openGraph()

		act(() => page.result.current.opened?.onClose())

		expect(page.result.current.isOpen).toBe(false)
	})

	it("closes and shows the panel picked in the rail", () => {
		const openSidebarTab = vi.fn()
		const page = openGraph(openSidebarTab)

		act(() => page.result.current.switchPanel("missions"))

		expect(page.result.current.isOpen).toBe(false)
		expect(openSidebarTab).toHaveBeenCalledWith("missions")
	})
})
