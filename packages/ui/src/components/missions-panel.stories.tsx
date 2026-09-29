import type { CSSProperties } from "react"
import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import {
	LONG_TITLE_MISSION,
	NO_SPACE_MISSIONS,
	SPACE_EARLIER_TODAY_MISSIONS,
	SPACE_LONG_TITLE_MISSIONS,
	SPACE_OPEN_MISSIONS,
	SPACE_WAITING_MISSIONS,
} from "@workspace/ui/components/missions.fixtures"
import {
	MissionsPanel,
	type MissionsPanelProps,
} from "@workspace/ui/components/missions-panel"
import { Sidebar, SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const PANEL_WIDTH = 304

const PANEL_STYLE = { "--sidebar-width": `${PANEL_WIDTH}px` } as CSSProperties

const renderInPanel = (args: MissionsPanelProps) => (
	<SidebarProvider style={PANEL_STYLE}>
		<Sidebar className="px-2 py-3" collapsible="none">
			<MissionsPanel {...args} />
		</Sidebar>
	</SidebarProvider>
)

const shownRows = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "mission-card-row").filter((row) =>
		row.checkVisibility(),
	)

const WIRED_BY_THE_APP =
	"`AppSidebar` mounts the panel in its Missions tab with the space-wide missions its host hands down."

const meta = preview.meta({
	title: "Navigation/MissionsPanel",
	component: MissionsPanel,
	render: renderInPanel,
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				component:
					"The body of the Missions tab: every mission of the space in the groups the Activity panel already draws, Waiting on you, In progress, then Earlier today folded. A row is `MissionCard` at row density, and activating it reports the mission and the conversation it belongs to.",
			},
		},
	},
	args: {
		open: SPACE_OPEN_MISSIONS,
		earlierToday: SPACE_EARLIER_TODAY_MISSIONS,
		onOpen: fn(),
	},
})

export const Default = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story: `The three groups as the V1f artboard draws them: two missions waiting on the reader, three in progress, four closed earlier today and folded. Check each head carries its count, that Earlier today reports itself collapsed and hides its rows. ${WIRED_BY_THE_APP}`,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const heads = ["Waiting on you", "In progress", "Earlier today"].map(
			(name) => canvas.getByRole("heading", { name: new RegExp(name) }),
		)
		await expect(heads[0]?.compareDocumentPosition(heads[1] as Node)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		)
		await expect(heads[1]?.compareDocumentPosition(heads[2] as Node)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		)
		await expect(
			within(slotIn(canvasElement, "missions-waiting")).getByText("2"),
		).toBeVisible()
		await expect(
			within(slotIn(canvasElement, "missions-inProgress")).getByText("3"),
		).toBeVisible()
		const fold = canvas.getByRole("button", { name: /Earlier today/ })
		await expect(fold).toHaveTextContent("4")
		await expect(fold).toHaveAttribute("aria-expanded", "false")
		await expect(shownRows(canvasElement)).toHaveLength(
			SPACE_OPEN_MISSIONS.length,
		)
	},
})

export const Empty = meta.story({
	args: { open: NO_SPACE_MISSIONS, earlierToday: NO_SPACE_MISSIONS },
	parameters: {
		docs: {
			description: {
				story: `A space where no companion has opened a mission yet. Check no group head is drawn and the empty state names what will show up here. ${WIRED_BY_THE_APP}`,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByRole("heading", { name: "No missions yet" }),
		).toBeVisible()
		await expect(
			canvas.getByText(
				"Missions your companions open in this space show up here.",
			),
		).toBeVisible()
		await expect(slotsIn(canvasElement, "mission-card-row")).toHaveLength(0)
	},
})

export const OneGroup = meta.story({
	args: { open: SPACE_WAITING_MISSIONS, earlierToday: NO_SPACE_MISSIONS },
	parameters: {
		docs: {
			description: {
				story: `Only missions waiting on the reader. Check the groups with nothing in them are left out rather than drawn empty. ${WIRED_BY_THE_APP}`,
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { name: "Waiting on you" }),
		).toBeVisible()
		await expect(
			canvas.queryByRole("heading", { name: "In progress" }),
		).not.toBeInTheDocument()
		await expect(
			canvas.queryByRole("button", { name: /Earlier today/ }),
		).not.toBeInTheDocument()
	},
})

export const EarlierTodayUnfolded = meta.story({
	parameters: {
		docs: {
			description: {
				story: `Earlier today opened from its head. Check the head reports itself expanded and its four closed missions show, muted, under the open groups. ${WIRED_BY_THE_APP}`,
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const fold = canvas.getByRole("button", { name: /Earlier today/ })
		await userEvent.click(fold)
		await expect(fold).toHaveAttribute("aria-expanded", "true")
		await expect(shownRows(canvasElement)).toHaveLength(
			SPACE_OPEN_MISSIONS.length + SPACE_EARLIER_TODAY_MISSIONS.length,
		)
	},
})

export const Toggling = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Earlier today opened then closed again. Check a second activation hides its rows.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const fold = canvas.getByRole("button", { name: /Earlier today/ })
		await userEvent.click(fold)
		await userEvent.click(fold)
		await expect(fold).toHaveAttribute("aria-expanded", "false")
		await expect(shownRows(canvasElement)).toHaveLength(
			SPACE_OPEN_MISSIONS.length,
		)
	},
})

export const OpeningAMission = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"A mission picked by pointer then by keyboard. Check both report the mission and the conversation it belongs to.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const [mission] = SPACE_OPEN_MISSIONS
		if (!mission) throw new Error("The fixture holds no mission")
		await userEvent.click(canvas.getByText(mission.objective))
		await expect(args.onOpen).toHaveBeenCalledWith(
			mission.id,
			mission.conversationId,
		)

		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)
		await expect(args.onOpen).toHaveBeenLastCalledWith(
			mission.id,
			mission.conversationId,
		)
	},
})

export const LongTitle = meta.story({
	tags: ["test-only"],
	args: { open: SPACE_LONG_TITLE_MISSIONS, earlierToday: NO_SPACE_MISSIONS },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose objective runs past the row at 304px. Check it stays on one line and ends in an ellipsis.",
			},
		},
	},
	play: async ({ canvas }) => {
		const title = canvas.getByText(LONG_TITLE_MISSION.objective)
		const style = getComputedStyle(title)
		await expect(style.textOverflow).toBe("ellipsis")
		await expect(style.whiteSpace).toBe("nowrap")
		await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
	},
})
