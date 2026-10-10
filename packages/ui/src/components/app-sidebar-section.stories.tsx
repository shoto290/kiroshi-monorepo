import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SidebarFrame, slotIn } from "@workspace/storybook/story-utils"
import {
	ATLAS,
	SIDEBAR_SECTION,
	STILL_LIFT,
} from "@workspace/ui/components/app-sidebar.fixtures"
import {
	RosterSection,
	SectionLabel,
	SectionNameField,
} from "@workspace/ui/components/app-sidebar-section"

const meta = preview.meta({
	title: "Navigation/AppSidebarSection",
	component: RosterSection,
	tags: ["test-only"],
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<SidebarFrame>
				<Story />
			</SidebarFrame>
		),
	],
	args: {
		section: SIDEBAR_SECTION,
		isFirst: true,
		isLast: true,
		isOpen: true,
		lift: STILL_LIFT,
		onOpenChange: fn(),
		children: ATLAS.name,
	},
})

export const OpenSection = meta.story({
	play: async ({ args, canvasElement }) => {
		const trigger = slotIn(canvasElement, "roster-section-trigger")
		await expect(trigger).toHaveAttribute("aria-expanded", "true")
		await expect(within(canvasElement).getByText(ATLAS.name)).toBeVisible()
		trigger.click()
		await expect(args.onOpenChange).toHaveBeenCalledWith(false)
	},
})

export const LabelAroundAName = meta.story({
	render: () => <SectionLabel>{SIDEBAR_SECTION.name}</SectionLabel>,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(SIDEBAR_SECTION.name),
		).toBeVisible()
	},
})

const commitName = fn()

export const NameFieldCommitsOnEnter = meta.story({
	render: () => (
		<SectionLabel>
			<SectionNameField
				ariaLabel={SIDEBAR_SECTION.name}
				initialName={SIDEBAR_SECTION.name}
				onCancel={fn()}
				onCommit={commitName}
			/>
		</SectionLabel>
	),
	play: async ({ canvasElement }) => {
		const field = within(canvasElement).getByRole("textbox")
		await expect(field).toHaveValue(SIDEBAR_SECTION.name)
		field.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		)
		await expect(commitName).toHaveBeenCalledWith(SIDEBAR_SECTION.name)
	},
})
