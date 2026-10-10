import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import {
	ATLAS,
	BEACON,
	DESK_ROOM,
} from "@workspace/ui/components/app-sidebar.fixtures"
import {
	BotRowAvatar,
	InsertionLine,
	LiftedRow,
	RosterDropArea,
	RosterZoneSeparator,
	SectionDropZone,
} from "@workspace/ui/components/app-sidebar-roster-parts"

const meta = preview.meta({
	title: "Navigation/AppSidebarRosterParts",
	component: RosterDropArea,
	tags: ["test-only"],
	parameters: { layout: "centered" },
	args: { landing: "desk", isLanding: false, children: null },
})

export const WorkingBotAvatar = meta.story({
	render: () => <BotRowAvatar bot={BEACON} />,
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("svg, img, canvas")).not.toBeNull()
	},
})

export const InsertionMarkAbove = meta.story({
	render: () => (
		<div className="relative h-10 w-48">
			<InsertionLine edge="above" />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(slotIn(canvasElement, "roster-insertion")).toHaveClass(
			"-top-0.5",
		)
	},
})

export const LiftedConversation = meta.story({
	render: () => <LiftedRow conversation={DESK_ROOM} ref={() => undefined} />,
	play: async ({ canvasElement }) => {
		const lifted = slotIn(canvasElement.ownerDocument.body, "roster-lifted-bot")
		await expect(lifted).toHaveAttribute("aria-hidden", "true")
	},
})

export const LandingAreaWithMarkBelow = meta.story({
	args: { isLanding: true, insertion: "below", children: ATLAS.name },
	play: async ({ canvasElement }) => {
		const area = slotIn(canvasElement, "roster-drop-area")
		await expect(area).toHaveAttribute("data-landing", "true")
		await expect(slotIn(area, "roster-insertion")).toHaveClass("-bottom-0.5")
	},
})

export const ZoneSeparator = meta.story({
	render: () => (
		<div className="flex w-48 flex-col">
			<RosterZoneSeparator />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			slotIn(canvasElement, "roster-zone-separator"),
		).toHaveAttribute("aria-hidden", "true")
	},
})

export const EmptySectionDrop = meta.story({
	render: () => <SectionDropZone name={ATLAS.name} />,
	play: async ({ canvasElement }) => {
		await expect(slotIn(canvasElement, "roster-section-drop")).toBeVisible()
	},
})
