import { useState } from "react"
import { expect, fireEvent, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_FLOATING_FOCUS_GUARDS,
	A11Y_SUBMENU_PORTAL_GUARD,
	FRAME_POLL,
	mergeA11y,
	tokenLengthOf,
} from "@workspace/storybook/story-utils"
import { ContextMenuPressTrigger } from "@workspace/ui/components/context-menu-press-trigger"
import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@workspace/ui/components/ui/context-menu"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"

const SURFACE =
	"flex h-40 w-72 items-center justify-center rounded-xl border border-border border-dashed bg-card text-muted-foreground text-sm"

const MENU_LABEL = "Transcript actions"

const SUBMENU_LABEL = "Move to"

const LONG_LABEL =
	"Everything this bot was asked to do since the beginning of the week"

const shownMenu = async (name: string) => {
	const menu = await screen.findByRole("menu", { name })
	await waitFor(() => expect(menu).toBeVisible(), FRAME_POLL)
	return menu
}

const openMenuOn = async (target: HTMLElement) => {
	fireEvent.contextMenu(target, { clientX: 180, clientY: 140 })
	return shownMenu(MENU_LABEL)
}

const TranscriptMenu = () => (
	<ContextMenuContent
		aria-label={MENU_LABEL}
		className={STILL_UNDER_REDUCED_MOTION}
	>
		<ContextMenuItem>
			<Icons.Copy aria-hidden="true" className="size-3.5" />
			Copy transcript
			<ContextMenuShortcut>⌘C</ContextMenuShortcut>
		</ContextMenuItem>
		<ContextMenuItem disabled>
			<Icons.Edit aria-hidden="true" className="size-3.5" />
			Rename
		</ContextMenuItem>
		<ContextMenuSub>
			<ContextMenuSubTrigger className="gap-2">
				<Icons.Folder aria-hidden="true" className="size-3.5" />
				{SUBMENU_LABEL}
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className={STILL_UNDER_REDUCED_MOTION}>
				<ContextMenuItem>Inbox</ContextMenuItem>
				<ContextMenuItem>Later</ContextMenuItem>
				<ContextMenuItem>Archive</ContextMenuItem>
			</ContextMenuSubContent>
		</ContextMenuSub>
		<ContextMenuSeparator />
		<ContextMenuItem variant="destructive">
			<Icons.Delete aria-hidden="true" className="size-3.5" />
			Delete
		</ContextMenuItem>
	</ContextMenuContent>
)

const TranscriptCard = () => (
	<ContextMenu>
		<ContextMenuTrigger
			render={
				<button className={SURFACE} type="button">
					Right-click this card
				</button>
			}
		/>
		<TranscriptMenu />
	</ContextMenu>
)

const ViewMenu = () => {
	const [wrap, setWrap] = useState(true)
	const [timestamps, setTimestamps] = useState(false)
	const [density, setDensity] = useState("cosy")

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<button className={SURFACE} type="button">
						Right-click this card
					</button>
				}
			/>
			<ContextMenuContent
				aria-label={MENU_LABEL}
				className={STILL_UNDER_REDUCED_MOTION}
			>
				<ContextMenuGroup>
					<ContextMenuLabel>Transcript</ContextMenuLabel>
					<ContextMenuCheckboxItem
						checked={wrap}
						onCheckedChange={setWrap}
						closeOnClick={false}
					>
						Wrap long lines
					</ContextMenuCheckboxItem>
					<ContextMenuCheckboxItem
						checked={timestamps}
						onCheckedChange={setTimestamps}
						closeOnClick={false}
					>
						Show timestamps
					</ContextMenuCheckboxItem>
				</ContextMenuGroup>
				<ContextMenuSeparator />
				<ContextMenuRadioGroup value={density} onValueChange={setDensity}>
					<ContextMenuLabel>Density</ContextMenuLabel>
					<ContextMenuRadioItem value="cosy">Cosy</ContextMenuRadioItem>
					<ContextMenuRadioItem value="compact">Compact</ContextMenuRadioItem>
				</ContextMenuRadioGroup>
			</ContextMenuContent>
		</ContextMenu>
	)
}

const meta = preview.meta({
	title: "Overlays/ContextMenu",
	component: ContextMenu,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The menu a surface offers when it is asked what it can do, as the shadcn registry ships it on the Base UI root. It opens on a right-click or a long press, anchored on the point the request came from, and is portalled out so it is never clipped by the row that owns it. Base UI runs the keyboard: arrows walk the list, typing jumps by `label`, Escape closes and hands focus back, and the highlighted item is the focused one — which is why the item's own `focus:bg-accent` is the focus indicator. Three item kinds compose inside it — plain, checkbox and radio — beside `ContextMenuLabel`, `ContextMenuSeparator` and `ContextMenuShortcut`. `ContextMenuSub` nests a second menu behind one row. `ContextMenuTrigger` takes a `render` element rather than wrapping its child, so the surface itself answers the right-click. For a control that must open the same menu on a plain left-click, reach for `ContextMenuPressTrigger` instead — `AsMenuButton` shows it.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The nominal case: actions on one object, the destructive one separated and toned apart at the bottom. Check the menu opens at the cursor rather than at the card's corner, that its corner is the one every other surface carries — the scale collapses `xl` and `2xl` onto `lg`, so the registry's own `rounded-xl` lands there without the file being touched — that the shortcut hint is decorative text and not a second control, and that Escape closes it. Pick `WithCheckboxAndRadioItems` for the stateful item kinds.",
			},
		},
	},
	render: () => <TranscriptCard />,
	play: async ({ canvas, userEvent }) => {
		const menu = await openMenuOn(canvas.getByText("Right-click this card"))

		await expect(
			screen.getByRole("menuitem", { name: /Copy transcript/ }),
		).toBeVisible()

		await expect(getComputedStyle(menu).borderStartStartRadius).toBe(
			tokenLengthOf("--radius-lg"),
		)

		await userEvent.keyboard("{Escape}")
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
	},
})

export const Closed = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The surface before anyone asks it anything, which is what a reader sees 99% of the time. Check that nothing of the menu is in the accessible tree while it is closed — no `menu` role, no item — so a screen reader walking the page never meets an action it cannot reach.",
			},
		},
	},
	render: () => <TranscriptCard />,
	play: async () => {
		await expect(screen.queryByRole("menu")).toBeNull()
		await expect(screen.queryByRole("menuitem")).toBeNull()
	},
})

export const WithCheckboxAndRadioItems = meta.story({
	parameters: {
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				story:
					"The two stateful item kinds under their group labels. Checkboxes carry `closeOnClick={false}` so a reader flips several settings in one visit — the reason to put them in a menu instead of a dialog. Check that a checked item, an unchecked item and the chosen radio all report through `aria-checked` and not through the tick alone, and that ticking one does not shift the label beside it.",
			},
		},
	},
	render: () => <ViewMenu />,
	play: async ({ canvas, userEvent }) => {
		await openMenuOn(canvas.getByText("Right-click this card"))

		const wrap = screen.getByRole("menuitemcheckbox", {
			name: "Wrap long lines",
		})
		await expect(wrap).toHaveAttribute("aria-checked", "true")
		await expect(
			screen.getByRole("menuitemcheckbox", { name: "Show timestamps" }),
		).toHaveAttribute("aria-checked", "false")

		await userEvent.click(wrap)
		await expect(
			screen.getByRole("menuitemcheckbox", { name: "Wrap long lines" }),
		).toHaveAttribute("aria-checked", "false")
	},
})

export const WithSubmenu = meta.story({
	parameters: {
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				story:
					"One row carrying a menu of its own. Check the branch reads as `aria-haspopup` before it opens, that hovering it opens the second menu beside the first without closing it, and that the chevron is decorative. Reach for a submenu only for a set of destinations too long to sit in the parent — one level, never two.",
			},
		},
	},
	render: () => <TranscriptCard />,
	play: async ({ canvas, userEvent }) => {
		const menu = await openMenuOn(canvas.getByText("Right-click this card"))

		const branch = await within(menu).findByRole("menuitem", {
			name: SUBMENU_LABEL,
		})
		await userEvent.hover(branch)

		const submenu = await shownMenu(SUBMENU_LABEL)
		await expect(
			within(submenu).getByRole("menuitem", { name: "Archive" }),
		).toBeVisible()
	},
})

export const States = meta.story({
	parameters: {
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				story:
					"The item states the menu draws: the focused item, which Base UI highlights by moving real focus onto it, and the disabled one, which keeps its place in the list and reports `data-disabled` rather than disappearing. Check the focused item is legible against `accent` in both themes, and that walking the list with the arrows never lands on the disabled row.",
			},
		},
	},
	render: () => <TranscriptCard />,
	play: async ({ canvas, userEvent }) => {
		const menu = await openMenuOn(canvas.getByText("Right-click this card"))

		await waitFor(() => expect(menu).toHaveFocus(), { timeout: 5000 })

		await userEvent.keyboard("{ArrowDown}")
		const copy = within(menu).getByRole("menuitem", { name: /Copy transcript/ })
		await waitFor(() => expect(copy).toHaveFocus(), { timeout: 5000 })

		await expect(
			within(menu).getByRole("menuitem", { name: "Rename" }),
		).toHaveAttribute("data-disabled")
	},
})

export const LongContent = meta.story({
	parameters: {
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				story:
					"A label longer than any menu should be, on a panel a call site bounded with `max-w-64`. The registry popup sets `min-w-36` and no maximum, so a menu that renders names the product does not author has to cap itself — every call site that lists a space or a section name does. Check the panel stops at 16rem and the label truncates instead of pushing the menu off screen.",
			},
		},
	},
	render: () => (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<button className={SURFACE} type="button">
						Right-click this card
					</button>
				}
			/>
			<ContextMenuContent
				aria-label={MENU_LABEL}
				className={`max-w-64 ${STILL_UNDER_REDUCED_MOTION}`}
			>
				<ContextMenuItem label={LONG_LABEL}>
					<Icons.Folder aria-hidden="true" className="size-3.5" />
					<span className="min-w-0 truncate">{LONG_LABEL}</span>
				</ContextMenuItem>
				<ContextMenuItem>
					<Icons.Copy aria-hidden="true" className="size-3.5" />
					Copy transcript
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
	play: async ({ canvas }) => {
		const menu = await openMenuOn(canvas.getByText("Right-click this card"))

		await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(256)
	},
})

export const AsMenuButton = meta.story({
	parameters: {
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				story:
					"The same menu behind a control that is expected to answer a plain left-click. `ContextMenuPressTrigger` forwards the press to the trigger as a context request anchored on the button's bottom edge, so the button keeps its own role and label and the menu still comes from the registry parts. Reach for it only where the menu is the button's whole purpose; a row that also does something else keeps the right-click trigger.",
			},
		},
	},
	render: () => (
		<ContextMenu>
			<ContextMenuPressTrigger
				render={<Button variant="outline">Transcript actions</Button>}
			/>
			<TranscriptMenu />
		</ContextMenu>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: MENU_LABEL }))

		await shownMenu(MENU_LABEL)
		await expect(
			screen.getByRole("menuitem", { name: /Copy transcript/ }),
		).toBeVisible()
	},
})
