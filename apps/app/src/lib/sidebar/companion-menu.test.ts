// @vitest-environment happy-dom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react"
import { createElement, type ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
	CompanionMenuHost,
	CompanionMenuProvider,
} from "@workspace/ui/components/companion-menu"
import "@workspace/ui/lib/i18n"

import {
	type CompanionMenuActions,
	type CompanionMenuSource,
	useCompanionMenuLookup,
} from "./companion-menu"

afterEach(cleanup)

const TRIGGER_NAME = "Right-click me"

const ATLAS = { id: "bot-atlas", name: "Atlas", pinPosition: null }

const SCRIBE = {
	id: "bot-scribe",
	name: "Scribe",
	pinPosition: 0,
	sectionId: "section-build",
}

const STANDUP = {
	id: "room-standup",
	name: "Standup",
	participants: [],
	pinPosition: 1,
	sectionId: null,
}

const actionsOf = (): CompanionMenuActions => ({
	onAddBotToSpace: vi.fn(),
	onDeleteBot: vi.fn(),
	onDuplicateBot: vi.fn(),
	onEditBot: vi.fn(),
	onPinRoster: vi.fn(),
	onRemoveBotFromSpace: vi.fn(),
})

const sourceWith = (actions: CompanionMenuActions): CompanionMenuSource => ({
	actions,
	botsBySpaceId: { perso: [ATLAS, SCRIBE], vocca: [ATLAS] },
	conversationsBySpaceId: { perso: [STANDUP] },
	openSpaceId: "perso",
	sectionsBySpaceId: {
		perso: [{ id: "section-build", name: "Build", position: 0 }],
	},
	spaces: [
		{ id: "perso", name: "Perso", colour: "blue" },
		{ id: "vocca", name: "Vocca", colour: "green" },
	],
})

type SubjectProps = {
	companionId: string
	source: CompanionMenuSource
}

const triggerButton = () =>
	createElement("button", { type: "button" }, TRIGGER_NAME) as ReactElement<
		Record<string, unknown>
	>

const Subject = ({ companionId, source }: SubjectProps) =>
	createElement(
		CompanionMenuProvider,
		{ menuFor: useCompanionMenuLookup(source) },
		createElement(CompanionMenuHost, {
			// biome-ignore lint/correctness/noChildrenProp: createElement types a required children prop through props only
			children: triggerButton(),
			companionId,
		}),
	)

const mounted = (companionId: string, actions = actionsOf()) => {
	render(createElement(Subject, { companionId, source: sourceWith(actions) }))
	return actions
}

const openMenu = async () => {
	fireEvent.contextMenu(screen.getByRole("button", { name: TRIGGER_NAME }), {
		clientX: 40,
		clientY: 40,
	})
	return within(await screen.findByRole("menu"))
}

const itemNames = (menu: ReturnType<typeof within>) =>
	menu.getAllByRole("menuitem").map((item: HTMLElement) => item.textContent)

describe("useCompanionMenuLookup", () => {
	it("offers the sidebar row items, in the sidebar row order", async () => {
		mounted("bot-atlas")

		expect(itemNames(await openMenu())).toEqual([
			"Pin",
			"Settings",
			"Duplicate",
			"Move to section",
			"Spaces",
			"Delete",
		])
	})

	it("offers Unpin for a companion pinned in the open space", async () => {
		mounted("bot-scribe")

		expect(itemNames(await openMenu())).toContain("Unpin")
	})

	it("offers no menu for a companion absent from the open space roster", () => {
		mounted("bot-ghost")

		fireEvent.contextMenu(screen.getByRole("button", { name: TRIGGER_NAME }), {
			clientX: 40,
			clientY: 40,
		})

		expect(screen.queryByRole("menu")).toBeNull()
	})

	it("pins the companion at the end of the open space pins", async () => {
		const actions = mounted("bot-atlas")

		fireEvent.click((await openMenu()).getByRole("menuitem", { name: "Pin" }))

		expect(actions.onPinRoster).toHaveBeenCalledWith("perso", [
			{ id: "section-build", sectionId: null },
			{ id: "bot-scribe", sectionId: "section-build" },
			{ id: "room-standup", sectionId: null },
			{ id: "bot-atlas", sectionId: null },
		])
	})

	it("unpins the companion pinned in the open space", async () => {
		const actions = mounted("bot-scribe")

		fireEvent.click((await openMenu()).getByRole("menuitem", { name: "Unpin" }))

		expect(actions.onPinRoster).toHaveBeenCalledWith("perso", [
			{ id: "section-build", sectionId: null },
			{ id: "room-standup", sectionId: null },
		])
	})

	it("runs the sidebar deletion for the companion", async () => {
		const actions = mounted("bot-atlas")

		fireEvent.click(
			(await openMenu()).getByRole("menuitem", { name: "Delete" }),
		)

		expect(actions.onDeleteBot).toHaveBeenCalledWith("bot-atlas")
	})

	it("runs the sidebar settings and duplication for the companion", async () => {
		const actions = mounted("bot-atlas")
		const menu = await openMenu()

		fireEvent.click(menu.getByRole("menuitem", { name: "Settings" }))

		expect(actions.onEditBot).toHaveBeenCalledWith("bot-atlas")

		fireEvent.click(
			(await openMenu()).getByRole("menuitem", { name: "Duplicate" }),
		)

		expect(actions.onDuplicateBot).toHaveBeenCalledWith("bot-atlas")
	})
})
