import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { ActivityRow } from "@workspace/ui/components/activity-row"
import { Icons } from "@workspace/ui/components/icons"
import { MISSION_BOT } from "@workspace/ui/components/missions.fixtures"
import { ROUTINES_PANEL_WIDTH } from "@workspace/ui/components/routines-panel"

const meta = preview.meta({
	title: "Conversation/Missions/ActivityRow",
	component: ActivityRow,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The bare row of the activity panel, filled by the run that reported: no border and no surface at rest, the companion's blot on the leading edge, a title line ending in the time, and a meta line of a mark and parts a middle dot opens. Reach for `ReportedRunRow` rather than this shell.",
			},
		},
	},
	args: {
		slot: "reported-run-row",
		bot: MISSION_BOT,
		title: "Morning digest",
		timestamp: "08:04",
		mark: Icons.Routine,
		parts: [
			{ key: "source", text: "On a schedule" },
			{ key: "bot", text: MISSION_BOT.name },
			{ key: "reported", text: "reported" },
		],
	},
	render: (args) => (
		<ul
			className="flex flex-col gap-0.5"
			style={{ width: ROUTINES_PANEL_WIDTH }}
		>
			<ActivityRow {...args} />
		</ul>
	),
})

export const Plain = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The row as `packages/ui/src/components/reported-run-row.tsx:34` fills it, the only caller outside a story: a title, a time, a routine mark and three parts, with nothing to open. Check that it carries no button, that its blot rests because no caller said it was working, and that the row is 52px tall.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
		await expect(
			canvas.getByRole("img", { name: "Companion avatar owl, idle" }),
		).toBeVisible()
		await expect(canvas.getByText("On a schedule")).toBeVisible()
		await expect(
			slotIn(canvasElement, "reported-run-row").getBoundingClientRect().height,
		).toBe(52)
	},
})
