// Call sites: packages/ui/src/components/app-sidebar.tsx line 1987 and
// packages/ui/src/components/space-switcher.tsx line 158

import { expect, screen, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_FLOATING_FOCUS_GUARDS,
	FRAME_POLL,
} from "@workspace/storybook/story-utils"
import { ContextMenuPressTrigger } from "@workspace/ui/components/context-menu-press-trigger"
import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
} from "@workspace/ui/components/ui/context-menu"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"

const MENU_LABEL = "Create"

const CREATE_BUTTON = (
	<Button aria-label={MENU_LABEL} size="icon-sm" variant="ghost">
		<Icons.Add aria-hidden="true" />
	</Button>
)

type CreateMenuProps = {
	render: typeof CREATE_BUTTON
}

const CreateMenu = ({ render }: CreateMenuProps) => (
	<ContextMenu>
		<ContextMenuPressTrigger render={render} />
		<ContextMenuContent
			aria-label={MENU_LABEL}
			className={STILL_UNDER_REDUCED_MOTION}
		>
			<ContextMenuItem>New conversation</ContextMenuItem>
			<ContextMenuItem>New bot</ContextMenuItem>
		</ContextMenuContent>
	</ContextMenu>
)

const meta = preview.meta({
	title: "Overlays/ContextMenuPressTrigger",
	component: ContextMenuPressTrigger,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The adapter that lets a plain left-click open a context menu. The registry trigger answers a right-click and anchors on the pointer; a header button and a space switcher are expected to answer a press and to drop their menu under themselves. This turns the press into a context request placed on the control's bottom edge, hands the trigger's own props to the element it is given through `render` — so the button keeps its role, its label and its variant — and adds the `aria-expanded` the pressed control owes a reader. Reach for it only where opening the menu is the control's whole purpose.",
			},
		},
	},
	args: { render: CREATE_BUTTON },
	render: (args) => <CreateMenu {...args} />,
})

export const Closed = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The control before the press, which is what a header shows almost all the time. Check that it is still the button the caller wrote — same accessible name, same icon-only size — that it says it opens a menu and that it is closed, and that no item of the menu is in the accessible tree yet. Pick `Open` for the state after the press.",
			},
		},
	},
	play: async ({ canvas }) => {
		const trigger = canvas.getByRole("button", { name: MENU_LABEL })

		await expect(trigger).toHaveAttribute("aria-haspopup", "menu")
		await expect(trigger).toHaveAttribute("aria-expanded", "false")
		await expect(screen.queryByRole("menu")).toBeNull()
	},
})

export const Open = meta.story({
	parameters: {
		a11y: A11Y_FLOATING_FOCUS_GUARDS,
		docs: {
			description: {
				story:
					"The menu a plain press opened. Check that the menu is drawn under the control rather than at the pointer — the press is replaced by a context request placed on the button's bottom edge, so the anchor is the same wherever in the button the reader clicked — and that the control now reads as expanded. Pick `Closed` for the state it returns to.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const trigger = canvas.getByRole("button", { name: MENU_LABEL })

		await userEvent.click(trigger)

		const menu = await screen.findByRole("menu", { name: MENU_LABEL })
		await waitFor(() => expect(menu).toBeVisible(), FRAME_POLL)

		await expect(trigger).toHaveAttribute("aria-expanded", "true")
		await expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			trigger.getBoundingClientRect().bottom - 1,
		)
	},
})
