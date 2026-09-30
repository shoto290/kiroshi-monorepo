import type { CSSProperties } from "react"
import { expect, fn, screen, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { probedStyleOf, slotIn } from "@workspace/storybook/story-utils"
import {
	AppRail,
	type AppRailPanel,
	type AppRailProps,
	NAVIGATION_ROW_GAP,
} from "@workspace/ui/components/app-rail"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { blotTint } from "@workspace/ui/components/companion-colour"
import {
	UpdateBadge,
	type UpdateBadgeStatus,
} from "@workspace/ui/components/update-badge"
import {
	SHELL_TITLE_BAR_HEIGHT,
	WorkspaceShell,
} from "@workspace/ui/components/workspace-shell"

const READER = { name: "Ada Lovelace" }

const OPENING_PANEL: AppRailPanel = "conversations"

const ENTRY_NAMES: Record<AppRailPanel, string> = {
	conversations: "Conversations",
	missions: "Missions",
}

const SPACE_SETTINGS = "Space settings"

const RAIL_WIDTH = 52

const REMOVED_PANEL = "companions"

const PANELS = Object.keys(ENTRY_NAMES) as AppRailPanel[]

const renderRail = (args: AppRailProps) => (
	<div className="flex h-[32rem] bg-background">
		<AppRail {...args} />
	</div>
)

const entryNamed = (canvasElement: HTMLElement, name: string) => {
	const entry = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('[data-slot="app-rail-item"]'),
	).find((item) => item.getAttribute("aria-label") === name)
	if (!entry) throw new Error(`No rail entry named ${name}`)
	return entry
}

const panelEntriesIn = (canvasElement: HTMLElement) =>
	Array.from(
		slotIn(canvasElement, "app-rail").querySelectorAll<HTMLElement>(
			'ul:first-of-type [data-slot="app-rail-item"]',
		),
	).map((entry) => entry.getAttribute("aria-label"))

const renderInSidebar = (openPanel: string) => () => (
	<WorkspaceShell sidebar={<AppSidebar bots={[]} openPanel={openPanel} />}>
		{null}
	</WorkspaceShell>
)

const bottomGroupItemsIn = (canvasElement: HTMLElement) =>
	Array.from(
		slotIn(canvasElement, "app-rail").querySelectorAll<HTMLElement>(
			"ul:last-of-type > li",
		),
	)

const expectBareBottomGroup = async (canvasElement: HTMLElement) => {
	const items = bottomGroupItemsIn(canvasElement).filter((item) =>
		item.checkVisibility(),
	)
	await expect(items).toHaveLength(2)
	await expect(within(items[0]).getByRole("button")).toBe(
		entryNamed(canvasElement, SPACE_SETTINGS),
	)
}

const updateBadgeIn = (status: UpdateBadgeStatus) => ({
	args: {
		updateBadge: <UpdateBadge progress={42} status={status} version="1.4.0" />,
	},
	play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const [slot, settingsItem] = bottomGroupItemsIn(canvasElement)
		const gear = entryNamed(canvasElement, SPACE_SETTINGS)
		await expect(slot).toHaveAttribute("data-slot", "app-rail-update")
		await expect(slot.nextElementSibling).toBe(settingsItem)
		await expect(settingsItem.contains(gear)).toBe(true)

		const badge = slot.firstElementChild as HTMLElement
		const badgeBox = badge.getBoundingClientRect()
		const gearBox = gear.getBoundingClientRect()
		await expect(badgeBox.left).toBe(gearBox.left)
		await expect(badgeBox.width).toBe(gearBox.width)
		await expect(badgeBox.height).toBe(gearBox.height)
		await expectListRowGapBetweenEntries(canvasElement)
	},
})

const boxesInGroup = (group: Element) =>
	Array.from(group.children)
		.filter((item) => item.checkVisibility())
		.map((item) =>
			(item.firstElementChild as HTMLElement).getBoundingClientRect(),
		)

const expectListRowGapBetweenEntries = async (canvasElement: HTMLElement) => {
	const listRowGap = Number.parseFloat(
		probedStyleOf(NAVIGATION_ROW_GAP, "rowGap"),
	)
	const groups = slotIn(canvasElement, "app-rail").querySelectorAll("ul")
	for (const group of groups) {
		const boxes = boxesInGroup(group)
		await expect(boxes.length).toBeGreaterThan(1)
		for (const [index, box] of boxes.slice(1).entries()) {
			await expect(box.top - boxes[index].bottom).toBe(listRowGap)
		}
	}
}

const verticalCentreOf = (box: DOMRect) => box.top + box.height / 2

const iconColourOf = (entry: HTMLElement) => getComputedStyle(entry).color

const fillOf = (entry: HTMLElement) => getComputedStyle(entry).backgroundColor

const expectOnlySelected = async (
	canvasElement: HTMLElement,
	selected: AppRailPanel,
) => {
	const selectedFill = probedStyleOf("bg-rail-item-selected", "backgroundColor")
	const selectedInk = probedStyleOf("text-foreground", "color")
	const idleInk = probedStyleOf("text-muted-foreground", "color")
	await expect(panelEntriesIn(canvasElement)).toEqual(
		PANELS.map((panel) => ENTRY_NAMES[panel]),
	)
	for (const panel of PANELS) {
		const entry = entryNamed(canvasElement, ENTRY_NAMES[panel])
		if (panel === selected) {
			await expect(entry).toHaveAttribute("aria-current", "true")
			await expect(fillOf(entry)).toBe(selectedFill)
			await expect(iconColourOf(entry)).toBe(selectedInk)
		} else {
			await expect(entry).not.toHaveAttribute("aria-current")
			await expect(iconColourOf(entry)).toBe(idleInk)
		}
	}
}

const selecting = (selected: AppRailPanel) => ({
	args: { selected },
	play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await expectOnlySelected(canvasElement, selected)
	},
})

const meta = preview.meta({
	title: "Navigation/AppRail",
	component: AppRail,
	render: renderRail,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The column of icons down the left edge of the window: the two panels a reader moves between, Conversations then Missions, then the space settings gear and the reader at the foot. The rail draws and reports; which panel is open and the dot on each entry are props, and each entry reports its own press. An entry is a button named by its panel, the open one marked `aria-current`, and the news it carries is spoken in its name, so a dot never rides on colour alone.",
			},
		},
	},
	args: {
		selected: OPENING_PANEL,
		user: READER,
		onSelectConversations: fn(),
		onSelectMissions: fn(),
		onOpenSpaceSettings: fn(),
		onOpenYou: fn(),
	},
})

export const ConversationsSelected = meta.story({
	...selecting("conversations"),
	play: async ({ canvasElement }) => {
		await expectOnlySelected(canvasElement, "conversations")
		await expectBareBottomGroup(canvasElement)
		await expectListRowGapBetweenEntries(canvasElement)
		await expect(
			canvasElement.querySelector('[data-slot="app-rail-dot"]'),
		).toBeNull()
	},
	parameters: {
		docs: {
			description: {
				story:
					"The rail as the app opens it. Check the conversation bubble sits on the white 8% fill in the foreground colour while Missions stays muted, that no other panel entry is drawn, and that the space settings gear and the reader's initial hold the foot of the rail.",
			},
		},
	},
})

export const MissionsSelected = meta.story(selecting("missions"))

export const RemovedPanelFallsBackToConversations = meta.story({
	render: renderInSidebar(REMOVED_PANEL),
	parameters: {
		docs: {
			description: {
				story:
					"A stored panel that the rail no longer offers, the Companions panel a reader may have left open before it was removed. Check the sidebar opens the Conversations panel, marks Conversations current and draws no entry for the removed panel.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expectOnlySelected(canvasElement, "conversations")
		await expect(
			canvas.getByRole("complementary", { name: ENTRY_NAMES.conversations }),
		).toBeVisible()
		await expect(
			within(slotIn(canvasElement, "app-rail")).queryByRole("button", {
				name: "Companions",
			}),
		).toBeNull()
	},
})

export const SpaceSettingsGearHovered = meta.story({
	args: { dots: { settings: true } },
	parameters: {
		docs: {
			description: {
				story:
					"The gear at the foot of the rail under the pointer, carrying a dot. Check the tooltip reads Space settings, that the name spoken for the gear is Space settings followed by the news it carries, and that a press opens the space settings.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const gear = entryNamed(canvasElement, `${SPACE_SETTINGS}, new activity`)
		await userEvent.hover(gear)
		await expect(await screen.findByRole("tooltip")).toHaveTextContent(
			SPACE_SETTINGS,
		)
		await userEvent.click(gear)
		await expect(args.onOpenSpaceSettings).toHaveBeenCalledTimes(1)
		await expect(args.onOpenYou).not.toHaveBeenCalled()
	},
})

export const FirstTabLevelWithPanelTitle = meta.story({
	render: renderInSidebar("conversations"),
	parameters: {
		docs: {
			description: {
				story:
					"The rail beside the panel it opens, under the title bar. Check the first tab is centred on the panel title row within 1px and that the rail stays 52px wide under a 34px title bar.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rail = slotIn(canvasElement, "app-rail")
		const [first] = Array.from(
			rail.querySelectorAll<HTMLElement>('[data-slot="app-rail-item"]'),
		).map((entry) => entry.getBoundingClientRect())
		const titleBar = slotIn(
			canvasElement,
			"app-title-bar",
		).getBoundingClientRect()
		const titleRow = within(slotIn(canvasElement, "sidebar-header"))
			.getByRole("heading", { name: ENTRY_NAMES.conversations })
			.parentElement?.getBoundingClientRect()
		if (!titleRow) throw new Error("No panel title row")
		await expect(
			Math.abs(verticalCentreOf(first) - verticalCentreOf(titleRow)),
		).toBeLessThanOrEqual(1)
		await expect(rail.getBoundingClientRect().width).toBe(RAIL_WIDTH)
		await expect(titleBar.height).toBe(SHELL_TITLE_BAR_HEIGHT)
	},
})

export const WithDot = meta.story({
	args: { dots: { conversations: true, missions: true } },
	parameters: {
		docs: {
			description: {
				story:
					"Two entries with something new, the way the reference draws them. Check each dot is 8px, primary, carries no number, flush with the top and trailing corner of its 36px entry and ringed 2px in the window ground, and that the entry's name says there is news.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const entry = entryNamed(canvasElement, "Conversations, new activity")
		const dot = slotIn(entry, "app-rail-dot").getBoundingClientRect()
		const box = entry.getBoundingClientRect()
		await expect(dot.width).toBe(8)
		await expect(dot.top).toBe(box.top)
		await expect(dot.right).toBe(box.right)
		await expect(slotIn(canvasElement, "app-rail")).not.toHaveTextContent(/\d/)
		await expect(
			slotIn(
				entryNamed(canvasElement, "Missions, new activity"),
				"app-rail-dot",
			),
		).toBeVisible()
		await expect(
			entryNamed(canvasElement, SPACE_SETTINGS).querySelector(
				'[data-slot="app-rail-dot"]',
			),
		).toBeNull()
	},
})

export const UpdateAvailable = meta.story({
	...updateBadgeIn("available"),
	parameters: {
		docs: {
			description: {
				story:
					"An update waiting to be downloaded, handed to the rail by the host. Check the badge is the first stop of the foot group, directly above the space settings gear, on the same column and in the same 36px square.",
			},
		},
	},
})

export const UpdateDownloading = meta.story({
	...updateBadgeIn("downloading"),
	parameters: {
		docs: {
			description: {
				story:
					"The update downloading, its ring filling around the badge. Check the ring holds the same 36px square as the gear under it and the rail does not shift while it fills.",
			},
		},
	},
})

export const UpdateReady = meta.story({
	...updateBadgeIn("ready"),
	parameters: {
		docs: {
			description: {
				story:
					"The update installed and waiting for a restart, its panel opening to the right of the rail. Check the badge keeps its place above the gear with the panel open.",
			},
		},
	},
})

export const UpdateAvailableDark = meta.story({
	...updateBadgeIn("available"),
	globals: { theme: "dark" },
})

export const UpdateIdle = meta.story({
	args: { updateBadge: <UpdateBadge status="idle" /> },
	parameters: {
		docs: {
			description: {
				story:
					"The state the app is in nearly all the time: the host hands the rail a badge that has nothing to show. Check the foot of the rail holds the gear and the reader only, with no gap held open above the gear.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectBareBottomGroup(canvasElement)
	},
})

export const KeyboardReach = meta.story({
	tags: ["test-only"],
	play: async ({ args, canvasElement, userEvent }) => {
		await userEvent.tab()
		const first = entryNamed(canvasElement, "Conversations")
		await expect(first).toHaveFocus()
		await expect(first).toHaveAttribute("type", "button")
		await expect(getComputedStyle(first).boxShadow).not.toBe("none")
		await userEvent.tab()
		await expect(entryNamed(canvasElement, "Missions")).toHaveFocus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onSelectMissions).toHaveBeenCalledTimes(1)
		await userEvent.click(entryNamed(canvasElement, READER.name))
		await expect(args.onOpenYou).toHaveBeenCalledTimes(1)
		await userEvent.click(entryNamed(canvasElement, SPACE_SETTINGS))
		await expect(args.onOpenSpaceSettings).toHaveBeenCalledTimes(1)
	},
})

type TintedShellStyle = CSSProperties & { "--space-tint": string }

const TINTED_SHELL: TintedShellStyle = { "--space-tint": blotTint("blue") }

export const OnTintedSpace = meta.story({
	args: { dots: { conversations: true, missions: true } },
	render: (args: AppRailProps) => (
		<div
			className="surface-shell flex h-[32rem]"
			data-space-tint="blue"
			style={TINTED_SHELL}
		>
			<AppRail {...args} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The rail on a space that carries a colour, which washes the shell surface behind it. Check the ring around each dot is the tinted surface itself, so no dot wears a halo of the uncoloured ground.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const ground = getComputedStyle(
			slotIn(canvasElement, "app-rail").parentElement as HTMLElement,
		).backgroundColor
		const dots = canvasElement.querySelectorAll('[data-slot="app-rail-dot"]')
		await expect(dots).toHaveLength(2)
		for (const dot of dots) {
			await expect(getComputedStyle(dot).boxShadow).toContain(ground)
		}
	},
})

export const Dark = meta.story({
	args: { dots: { conversations: true, missions: true } },
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => {
		await expectListRowGapBetweenEntries(canvasElement)
	},
})
