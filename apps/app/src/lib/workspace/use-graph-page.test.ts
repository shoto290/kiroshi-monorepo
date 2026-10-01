// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useGraphPage } from "./use-graph-page"

import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"

const SPACE = { id: "personal", name: "Personal" }

const openGraph = (openSidebarTab = vi.fn()) => {
	const store = createFakeTranscriptStore()
	const page = renderHook(() =>
		useGraphPage({ store, space: SPACE, openSidebarTab }),
	)
	act(() => page.result.current.toggle?.())
	return page
}

afterEach(cleanup)

describe("the graph page", () => {
	it("reads the opened space after showing that it is reading", async () => {
		const page = openGraph()
		expect(page.result.current.opened?.state).toEqual({ status: "loading" })

		await waitFor(() =>
			expect(page.result.current.opened?.state).toMatchObject({
				status: "ready",
				graph: { space: SPACE },
			}),
		)
	})

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
