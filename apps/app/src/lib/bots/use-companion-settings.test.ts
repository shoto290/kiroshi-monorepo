// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
	type CompanionSettings,
	useCompanionSettings,
} from "./use-companion-settings"

afterEach(cleanup)

const opener = () => vi.fn(() => Promise.resolve())

const panelsOf = () => ({
	applications: { open: opener() },
	skills: { open: opener() },
	servers: { open: opener() },
	environment: { open: opener() },
	connections: { open: opener() },
	history: { open: opener() },
})

type Panels = ReturnType<typeof panelsOf>

const readCounts = (panels: Panels) =>
	Object.values(panels).map((panel) => panel.open.mock.calls.length)

const mounted = (panels: Panels, isOpen: boolean) =>
	renderHook(
		({ isOpen: opened }: Pick<CompanionSettings, "isOpen">) =>
			useCompanionSettings({
				...panels,
				companionId: "scribe",
				spaceId: "personal",
				isOpen: opened,
			}),
		{ initialProps: { isOpen } },
	)

describe("useCompanionSettings", () => {
	it("reads every companion panel when the settings dialog opens", () => {
		const panels = panelsOf()

		mounted(panels, true)

		expect(readCounts(panels)).toEqual([1, 1, 1, 1, 1, 1])
		expect(panels.servers.open).toHaveBeenCalledWith({
			kind: "bot",
			id: "scribe",
			spaceId: "personal",
		})
	})

	it("reads none of them while the settings dialog is closed", () => {
		const panels = panelsOf()

		mounted(panels, false)

		expect(readCounts(panels)).toEqual([0, 0, 0, 0, 0, 0])
	})

	it("reads them again on a second opening on the same companion", () => {
		const panels = panelsOf()
		const rendered = mounted(panels, true)

		rendered.rerender({ isOpen: false })
		rendered.rerender({ isOpen: true })

		expect(readCounts(panels)).toEqual([2, 2, 2, 2, 2, 2])
	})
})
