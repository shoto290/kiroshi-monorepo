// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
	type SidebarActionsSource,
	useSidebarActions,
} from "./use-sidebar-actions"

import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import { spacePlugin } from "../conversations/plugin-scope"
import { createPluginController } from "../plugins/plugin-controller"
import {
	createSpacesController,
	type SpacesController,
} from "../spaces/spaces-controller"

const UNUSED = {} as never

const gearFor = (spaces: SpacesController) => {
	const store = createFakeTranscriptStore()
	const plugin = createPluginController(store)
	const opening = vi.spyOn(plugin, "open")
	const source: SidebarActionsSource = {
		attachments: UNUSED,
		collapsedSections: UNUSED,
		drafts: UNUSED,
		roster: UNUSED,
		runtimes: UNUSED,
		sections: UNUSED,
		spacePlugin: plugin,
		spaces,
		user: UNUSED,
		userPlugin: UNUSED,
	}
	const { result } = renderHook(() => useSidebarActions(source))
	return { press: result.current.onOpenSpaceSettings, opening }
}

afterEach(cleanup)

describe("the rail gear", () => {
	it("opens the settings of the selected space", async () => {
		const store = createFakeTranscriptStore()
		const shown = await store.createSpace("Vocca")
		const spaces = createSpacesController(store)
		await spaces.load(shown.id)
		const gear = gearFor(spaces)

		gear.press()

		expect(spaces.getState().isSettingsOpen).toBe(true)
		expect(gear.opening).toHaveBeenCalledWith(spacePlugin(shown.id))
	})

	it("opens no space plugin when no space is selected", () => {
		const spaces = createSpacesController(createFakeTranscriptStore())
		const gear = gearFor(spaces)

		gear.press()

		expect(gear.opening).not.toHaveBeenCalled()
	})
})
