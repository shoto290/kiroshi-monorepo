import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { probedStyleOf, slotIn } from "@workspace/storybook/story-utils"
import {
	AppRail,
	type AppRailPanel,
	type AppRailProps,
} from "@workspace/ui/components/app-rail"

const READER = { name: "Ada Lovelace" }

const OPENING_PANEL: AppRailPanel = "conversations"

const ENTRY_NAMES: Record<AppRailPanel, string> = {
	conversations: "Conversations",
	missions: "Missions",
	companions: "Companions",
	applications: "Applications",
}

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

const iconColourOf = (entry: HTMLElement) => getComputedStyle(entry).color

const fillOf = (entry: HTMLElement) => getComputedStyle(entry).backgroundColor

const expectOnlySelected = async (
	canvasElement: HTMLElement,
	selected: AppRailPanel,
) => {
	const selectedFill = probedStyleOf("bg-rail-item-selected", "backgroundColor")
	const selectedInk = probedStyleOf("text-foreground", "color")
	const idleInk = probedStyleOf("text-muted-foreground", "color")
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
					"The column of icons down the left edge of the window: the four panels a reader moves between, then settings and the reader at the foot. The rail draws and reports; which panel is open, the count and the dot on each entry are props, and each entry reports its own press. An entry is a button named by its panel, the open one marked `aria-current`, and the news it carries is spoken in its name, so a dot or a count never rides on colour alone.",
			},
		},
	},
	args: {
		selected: OPENING_PANEL,
		user: READER,
		onSelectConversations: fn(),
		onSelectMissions: fn(),
		onSelectCompanions: fn(),
		onSelectApplications: fn(),
		onOpenSettings: fn(),
		onOpenYou: fn(),
	},
})

export const ConversationsSelected = meta.story({
	...selecting("conversations"),
	parameters: {
		docs: {
			description: {
				story:
					"The rail as the app opens it. Check the conversation bubble sits on the white 8% fill in the foreground colour while every other icon stays muted, and that the settings gear and the reader's initial hold the foot of the rail.",
			},
		},
	},
})

export const MissionsSelected = meta.story(selecting("missions"))

export const CompanionsSelected = meta.story(selecting("companions"))

export const ApplicationsSelected = meta.story(selecting("applications"))

export const WithDot = meta.story({
	args: { dots: { conversations: true, missions: true } },
	parameters: {
		docs: {
			description: {
				story:
					"Two entries with something new, the way the reference draws them. Check each dot is 8px, primary, flush with the top and trailing corner of its 36px entry and ringed 2px in the window ground, and that the entry's name says there is news.",
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
		await expect(
			slotIn(
				entryNamed(canvasElement, "Missions, new activity"),
				"app-rail-dot",
			),
		).toBeVisible()
		await expect(
			entryNamed(canvasElement, "Companions").querySelector(
				'[data-slot="app-rail-dot"]',
			),
		).toBeNull()
	},
})

export const WithCount = meta.story({
	args: { counts: { conversations: 3, missions: 120 } },
	parameters: {
		docs: {
			description: {
				story:
					"Entries carrying a count. The reference draws no count, so the badge is placed off the dot: a primary pill on the same corner, ringed in the ground, with tabular figures. Check the count is drawn and spoken, that a count past 99 reads 99+ on the pill while the name keeps the real number, and that a count replaces the dot rather than stacking on it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const conversations = entryNamed(canvasElement, "Conversations, 3 new")
		await expect(slotIn(conversations, "app-rail-count")).toHaveTextContent("3")
		const missions = entryNamed(canvasElement, "Missions, 120 new")
		await expect(slotIn(missions, "app-rail-count")).toHaveTextContent("99+")
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
		await userEvent.click(entryNamed(canvasElement, "Settings"))
		await expect(args.onOpenSettings).toHaveBeenCalledTimes(1)
	},
})

export const Dark = meta.story({
	args: { dots: { conversations: true, missions: true } },
	globals: { theme: "dark" },
})
