import { expect, fireEvent, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { shown } from "@workspace/storybook/story-utils"
import {
	CompanionMenuContent,
	type CompanionMenuSubject,
} from "@workspace/ui/components/companion-menu"
import type { Space } from "@workspace/ui/components/space"
import {
	ContextMenu,
	ContextMenuTrigger,
} from "@workspace/ui/components/ui/context-menu"

const ATLAS: CompanionMenuSubject = {
	id: "bot-atlas",
	name: "Atlas",
	sectionId: "section-build",
}

const SPACES: Space[] = [
	{ id: "perso", name: "Perso", colour: "blue" },
	{ id: "vocca", name: "Vocca", colour: "green" },
]

const SECTIONS = [
	{ id: "section-build", name: "Build" },
	{ id: "section-review", name: "Review" },
]

const MEMBERSHIPS = ["perso", "vocca"]

const MENU_LABEL = "Actions for Atlas"

const SURFACE =
	"flex h-32 w-64 items-center justify-center rounded-xl border border-border border-dashed bg-card text-muted-foreground text-sm"

const TRIGGER_LABEL = "Right-click this companion"

const ITEMS_IN_ORDER = [
	"Pin",
	"Settings",
	"Duplicate",
	"Move to section",
	"Spaces",
	"Delete",
]

const openMenu = async (target: HTMLElement) => {
	fireEvent.contextMenu(target, { clientX: 120, clientY: 90 })
	return within(
		await shown(await screen.findByRole("menu", { name: MENU_LABEL })),
	)
}

const meta = preview.meta({
	title: "Overlays/CompanionMenu",
	component: CompanionMenuContent,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"Everything the app can do to one companion, in one menu. It is the menu the roster row has always opened on a right-click, lifted out of that row so the same list can hang off any surface naming a companion — the roster row, the avatar in the transcript gutter, a mention inside a message. It is a `ContextMenuContent`, so it is given to a `ContextMenu` beside its trigger and never rendered on its own. The order is fixed: the pin toggle and its separator first, then Settings, Duplicate, the section branch, the spaces branch, and Delete apart at the bottom. Settings, Duplicate and Delete are always drawn — each calls the callback it was given and does nothing when it was given none. The three that answer to the host are the pin toggle, which needs `onPin` or `onUnpin` depending on `isPinned`, the section branch, which needs `onMoveToSection` or `onCreateSectionFor`, and the spaces branch, which needs `onAddToSpace` or `onRemoveFromSpace` plus spaces and memberships to list: each of those draws nothing at all without them. Outside the roster, `CompanionMenuProvider` is what hands this content to the transcript: it answers one companion id with one menu, and a surface it answers nothing for keeps the markup it had.",
			},
		},
	},
	args: {
		companion: ATLAS,
		isPinned: false,
		memberships: MEMBERSHIPS,
		sections: SECTIONS,
		spaces: SPACES,
		openSpaceId: "perso",
		onPin: fn(),
		onUnpin: fn(),
		onEdit: fn(),
		onDuplicate: fn(),
		onAddToSpace: fn(),
		onRemoveFromSpace: fn(),
		onDelete: fn(),
		onMoveToSection: fn(),
		onCreateSectionFor: fn(),
	},
	render: (args) => (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<button className={SURFACE} type="button">
						{TRIGGER_LABEL}
					</button>
				}
			/>
			<CompanionMenuContent {...args} />
		</ContextMenu>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The whole list, on a companion the app can pin, move and remove. Check the order a reader scans top to bottom — Pin, Settings, Duplicate, Move to section, Spaces, Delete — that the pin toggle is fenced off by its own separator, and that Delete is the only item toned as destructive. This is the same list `AppSidebar` opens on a roster row: a change here changes the row.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenu(canvas.getByText(TRIGGER_LABEL))

		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(ITEMS_IN_ORDER)
	},
})

export const Pinned = meta.story({
	args: { isPinned: true },
	parameters: {
		docs: {
			description: {
				story:
					"The same companion, already pinned. Check that the first item reads Unpin rather than Pin and keeps its own separator under it — the toggle is one item that flips, never two items stacked. Pick `Default` for the companion that is not pinned yet.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenu(canvas.getByText(TRIGGER_LABEL))
		const [first] = menu.getAllByRole("menuitem")

		await expect(first).toHaveTextContent("Unpin")
	},
})

export const WithoutBranches = meta.story({
	args: {
		onPin: undefined,
		onUnpin: undefined,
		onAddToSpace: undefined,
		onRemoveFromSpace: undefined,
		onMoveToSection: undefined,
		onCreateSectionFor: undefined,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A host that wired only `onEdit`, `onDuplicate` and `onDelete` — the transcript today, which can open a companion's settings but does not own its pins, sections or spaces. Check that the menu is exactly Settings, Duplicate and Delete: the pin toggle, the section branch and the spaces branch draw nothing without a callback, and the separators around them collapse with them rather than leaving a gap. Pick `Default` for the roster host, which wires all of them.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenu(canvas.getByText(TRIGGER_LABEL))

		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Settings", "Duplicate", "Delete"])
	},
})

const TITLED_ATLAS: CompanionMenuSubject = {
	...ATLAS,
	title: "Research lead",
	animal: "owl",
	blot: "blue",
}

const openMenuOn = async (target: HTMLElement, name = MENU_LABEL) => {
	fireEvent.contextMenu(target, { clientX: 120, clientY: 90 })
	return shown(await screen.findByRole("menu", { name }))
}

const LONG_NAME = "Atlas the quarterly infrastructure capacity planner"

const slotIn = (element: HTMLElement, slot: string) =>
	element.querySelector<HTMLElement>(`[data-slot="${slot}"]`)

export const WithHeader = meta.story({
	args: { companion: TITLED_ATLAS },
	parameters: {
		docs: {
			description: {
				story:
					"The menu opened on a companion that carries a title. Check that a header naming it sits above every item: its avatar, its name and its title pill, fenced off by a separator. The header is a label, not an item: the down arrow lands on Pin first. Pick `WithHeaderUntitled` for a companion with no title.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenuOn(canvas.getByText(TRIGGER_LABEL))
		const header = slotIn(menu, "companion-menu-header")
		if (!header) throw new Error("The menu drew no header")

		await expect(menu.firstElementChild?.contains(header)).toBe(true)
		await expect(slotIn(header, "bot-identity-avatar")).not.toBeNull()
		await expect(
			slotIn(header, "companion-menu-header-name"),
		).toHaveTextContent("Atlas")
		await expect(slotIn(header, "bot-title-badge")).toHaveTextContent(
			"Research lead",
		)
		await expect(header.nextElementSibling).toHaveAttribute(
			"data-slot",
			"context-menu-separator",
		)
		await expect(
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent),
		).toEqual(ITEMS_IN_ORDER)

		fireEvent.keyDown(menu, { key: "ArrowDown" })

		await waitFor(() => expect(document.activeElement).toHaveTextContent("Pin"))
	},
})

export const WithHeaderUntitled = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same header on a companion with no title. Check it carries the avatar and the name alone, with no empty pill left behind. Pick `WithHeader` for a titled companion.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenuOn(canvas.getByText(TRIGGER_LABEL))
		const header = slotIn(menu, "companion-menu-header")
		if (!header) throw new Error("The menu drew no header")

		await expect(slotIn(header, "bot-identity-avatar")).not.toBeNull()
		await expect(
			slotIn(header, "companion-menu-header-name"),
		).toHaveTextContent("Atlas")
		await expect(slotIn(header, "bot-title-badge")).toBeNull()
	},
})

export const WithHeaderLongContent = meta.story({
	tags: ["test-only"],
	args: {
		companion: {
			...TITLED_ATLAS,
			name: LONG_NAME,
			title: "Release manager for the whole desktop platform",
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"A header whose name and title are both longer than the menu. Check that the menu keeps the width its items give it and the header cuts inside it with an ellipsis instead of stretching the menu.",
			},
		},
	},
	play: async ({ canvas }) => {
		const menu = await openMenuOn(
			canvas.getByText(TRIGGER_LABEL),
			`Actions for ${LONG_NAME}`,
		)
		const header = slotIn(menu, "companion-menu-header")
		const name = header && slotIn(header, "companion-menu-header-name")
		const title = header && slotIn(header, "bot-title-badge")
		if (!header || !name || !title)
			throw new Error("The header drew a part short")

		await expect(header.getBoundingClientRect().right).toBeLessThanOrEqual(
			menu.getBoundingClientRect().right,
		)
		await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
		await expect(header.getBoundingClientRect().height).toBeLessThan(32)
	},
})
