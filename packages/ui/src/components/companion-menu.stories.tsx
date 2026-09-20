import { expect, fireEvent, fn, screen, within } from "storybook/test"

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
					"Everything the app can do to one companion, in one menu. It is the menu the roster row has always opened on a right-click, lifted out of that row so the same list can hang off any surface naming a companion — the roster row, the avatar in the transcript gutter, a mention inside a message. It is a `ContextMenuContent`, so it is given to a `ContextMenu` beside its trigger and never rendered on its own. The order is fixed: the pin toggle and its separator first, then Settings, Duplicate, the section branch, the spaces branch, and Delete apart at the bottom. A branch that has no host callback draws nothing, which is how a host offers a subset without a flag. Outside the roster, `CompanionMenuProvider` is what hands this content to the transcript: it answers one companion id with one menu, and a surface with no answer keeps the markup it had.",
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
