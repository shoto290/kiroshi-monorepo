// @vitest-environment happy-dom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react"
import { createElement, Fragment } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NoticeSurface } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { SpaceSettingsHost } from "@/components/space-settings-host"
import type { JoinedSpace } from "@/lib/bindings"
import { createFakeTranscriptStore } from "@/lib/conversations/fake-transcript-store"
import {
	createJoinedSpacesController,
	type JoinedSpacesController,
	type JoinedSpacesTransport,
} from "@/lib/spaces/joined-spaces-controller"
import {
	createSpacesController,
	type SpacesController,
} from "@/lib/spaces/spaces-controller"
import { useControllerState } from "@/lib/use-controller"
import type { ApplicationScopes } from "@/lib/workspace/use-application-scopes"
import type { SettingsPanels } from "@/lib/workspace/use-settings-panels"
import type { WorkspaceCore } from "@/lib/workspace/use-workspace-core"

const GARAGE: JoinedSpace = {
	id: "joined-garage",
	hostUrl: "http://192.168.1.20:45367",
	remoteSpaceId: "garage",
	name: "Garage",
}

type Gear = {
	spaces: SpacesController
	joined: JoinedSpacesController
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const garageTransport = () =>
	({
		list: async () => [GARAGE],
		add: async () => GARAGE,
		remove: vi.fn(async (_id: string) => undefined),
		onChanged: async () => () => undefined,
	}) satisfies JoinedSpacesTransport

const hostsFake = () => ({
	getState: () => ({ active: null, connections: {} }),
	subscribe: () => () => undefined,
	connect: async () => undefined,
	activate: async () => undefined,
	forget: () => undefined,
})

const gearWithGarage = async () => {
	const store = createFakeTranscriptStore()
	const home = await store.createSpace("Home")
	const spaces = createSpacesController(store)
	await spaces.load(home.id)
	const transport = garageTransport()
	const joined = createJoinedSpacesController({
		spaces,
		hosts: hostsFake(),
		transport,
	})
	joined.watch()
	await settle()
	return { home, spaces, joined, transport }
}

const SpaceSettingsHarness = ({ spaces, joined }: Gear) => {
	const spacesState = useControllerState(spaces)
	const joinedState = useControllerState(joined)
	const { selectedSpaceId } = spacesState
	const core = {
		joinedSpaces: { state: joinedState, controller: joined },
		spaces: { state: spacesState, controller: spaces },
		spaceEnvironment: {
			state: { entries: [], hasFailedToRead: false },
			controller: { remove: vi.fn(), set: vi.fn() },
		},
		spaceMcpServers: { state: { hasFailedToLoad: false } },
	} as unknown as WorkspaceCore
	const panels = {
		applicationToOpenOn: () => undefined,
		closeSettingsTab: () => undefined,
		spaceHistory: { days: [], oldestDate: "2026-01-01", onUndo: vi.fn() },
		spaceSkills: { skills: [] },
	} as unknown as SettingsPanels
	const scopes = {
		isSpaceEditing: spacesState.isSettingsOpen,
		selectedSpace: spacesState.spaces.find(
			(space) => space.id === selectedSpaceId,
		),
		selectedSpaceId,
		setOpenedMcpServer: vi.fn(),
		spaceApplications: { mcpServers: [] },
	} as unknown as ApplicationScopes
	return createElement(
		Fragment,
		null,
		createElement(SpaceSettingsHost, { core, panels, scopes }),
		createElement(NoticeSurface),
	)
}

const openSettingsOf = (gear: Gear, rowId: string) => {
	gear.joined.selectSpace(rowId)
	gear.spaces.setSettingsOpen(true)
	render(createElement(SpaceSettingsHarness, gear))
	return screen.getByRole("dialog")
}

const confirmLeave = async (dialog: HTMLElement) => {
	const leaveAction = i18n.t("common:spaces.leave.action")
	fireEvent.click(
		within(dialog).getByRole("tab", { name: i18n.t("settings:rail.danger") }),
	)
	fireEvent.click(
		await within(dialog).findByRole("button", { name: leaveAction }),
	)
	const confirm = await screen.findByRole("alertdialog")
	await act(async () => {
		fireEvent.click(within(confirm).getByRole("button", { name: leaveAction }))
	})
}

afterEach(() => {
	cleanup()
})

describe("SpaceSettingsHost on a joined space", () => {
	it("opens the joined mode with the space name and host, without the local-only parts", async () => {
		const gear = await gearWithGarage()

		const dialog = openSettingsOf(gear, "garage")

		expect(within(dialog).getByDisplayValue("Garage")).toBeTruthy()
		expect(within(dialog).getByDisplayValue(GARAGE.hostUrl)).toBeTruthy()
		for (const localOnly of [
			i18n.t("settings:space.colour.label"),
			i18n.t("settings:space.share.label"),
			i18n.t("settings:space.transfer.export"),
			i18n.t("settings:space.transfer.import"),
		]) {
			expect(within(dialog).queryByText(localOnly)).toBeNull()
		}
	})

	it("leaves through the roster path, closes the dialog and selects the first local space", async () => {
		const gear = await gearWithGarage()
		const dialog = openSettingsOf(gear, "garage")

		await confirmLeave(dialog)

		expect(gear.transport.remove).toHaveBeenCalledWith(GARAGE.id)
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { hidden: true })).toBeNull(),
		)
		expect(gear.joined.getState().joinedSpaces).toEqual([])
		const [firstLocal] = gear.spaces.getState().spaces
		expect(gear.spaces.getState().selectedSpaceId).toBe(firstLocal?.id)
	})

	it("keeps the space and raises the refusal when the leave fails", async () => {
		const gear = await gearWithGarage()
		gear.transport.remove.mockRejectedValueOnce(new Error("disk full"))
		const dialog = openSettingsOf(gear, "garage")

		await confirmLeave(dialog)

		expect(await screen.findAllByText("disk full")).not.toHaveLength(0)
		expect(gear.joined.getState().joinedSpaces).toEqual([GARAGE])
		expect(gear.spaces.getState().selectedSpaceId).toBe("garage")
		expect(screen.getByRole("dialog", { hidden: true })).toBeTruthy()
	})
})

describe("SpaceSettingsHost on a local space", () => {
	it("opens the local mode with its colour and transfer actions", async () => {
		const gear = await gearWithGarage()

		const dialog = openSettingsOf(gear, gear.home.id)

		expect(within(dialog).getByDisplayValue("Home")).toBeTruthy()
		expect(
			within(dialog).getByText(i18n.t("settings:space.colour.label")),
		).toBeTruthy()
		expect(
			within(dialog).getByRole("button", {
				name: i18n.t("settings:space.transfer.export"),
			}),
		).toBeTruthy()
	})
})
