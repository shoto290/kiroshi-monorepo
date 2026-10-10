import { expect, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { DaySeparator } from "@workspace/ui/components/day-separator"

const READ_ON = new Date(2026, 9, 10, 9, 30).getTime()

const meta = preview.meta({
	title: "Conversation/Message/DaySeparator",
	component: DaySeparator,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The line a thread draws before its first message and wherever the calendar day changes between two messages. It reads the day in the reader's own time zone and names it Today, Yesterday, or by day and month, with the year only when it is not the current one. The rules on either side are hidden from assistive technology, which reads the label alone.",
			},
		},
	},
	args: { now: READ_ON },
	render: (args) => (
		<div className="mx-auto max-w-2xl">
			<DaySeparator {...args} />
		</div>
	),
})

export const Today = meta.story({
	args: { at: new Date(2026, 9, 10, 0, 3).getTime() },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("Today")).toBeVisible()
		await expect(
			within(canvasElement).queryAllByRole("separator"),
		).toHaveLength(0)
	},
})

export const Yesterday = meta.story({
	args: { at: new Date(2026, 9, 9, 23, 48).getTime() },
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Yesterday")).toBeVisible()
	},
})

export const EarlierThisYear = meta.story({
	args: { at: new Date(2026, 2, 4, 14, 0).getTime() },
	play: async ({ canvas }) => {
		await expect(canvas.getByText("March 4")).toBeVisible()
	},
})

export const PreviousYear = meta.story({
	args: { at: new Date(2025, 11, 31, 22, 0).getTime() },
	play: async ({ canvas }) => {
		await expect(canvas.getByText("December 31, 2025")).toBeVisible()
	},
})
