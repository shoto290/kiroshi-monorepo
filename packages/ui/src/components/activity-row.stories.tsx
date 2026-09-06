import { expect, fn } from "storybook/test"

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
					"The bare row of the activity panel, shared by a mission and by a run that reported: no border and no surface at rest, the bot's blot on the leading edge, a title line ending in the time, and a meta line of a mark, an optional identifier and parts a middle dot opens. A row given something to open answers the pointer and the keyboard; a row given nothing is plain text. Reach for `MissionRow` or `ReportedRunRow` rather than this shell.",
			},
		},
	},
	args: {
		slot: "activity-row",
		bot: MISSION_BOT,
		title: "Rewrite the changelog parser",
		timestamp: "1h",
		mark: Icons.Linear,
		identifier: "OPE-42",
		parts: [{ key: "bot", text: MISSION_BOT.name }],
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
					"The row with nothing to open. Check that it carries no button, that the identifier keeps its room beside the mark, and that the row is 52px tall.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
		await expect(canvas.getByText("OPE-42")).toBeVisible()
		await expect(
			slotIn(canvasElement, "activity-row").getBoundingClientRect().height,
		).toBe(52)
	},
})

export const Activatable = meta.story({
	args: {
		activation: { id: "mission-parser", onOpen: fn() },
		badge: "attention",
		spokenState: "Waiting for you",
	},
	parameters: {
		docs: {
			description: {
				story:
					"The row given something to open, with a badge dot on its blot. Check that the whole row is the button, that it names what it opens for the focus that comes back to it, that the badge dot is spoken as well as drawn, and that pressing it reports the activation.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const row = canvas.getByRole("button")

		await expect(row).toHaveAttribute("data-opens", "mission-parser")
		await expect(
			canvasElement.querySelector('[data-slot="bot-activity-dot"]'),
		).toHaveAttribute("data-badge", "attention")
		await expect(canvas.getByText("Waiting for you")).toBeInTheDocument()

		await userEvent.click(row)
		await expect(args.activation?.onOpen).toHaveBeenCalled()
	},
})

export const MutedTitle = meta.story({
	args: { isTitleMuted: true, timestamp: "09:12" },
	parameters: {
		docs: {
			description: {
				story:
					"The row of something already closed. Check that the title drops to the muted colour at regular weight while the meta line keeps its own, and that the clock time takes the trailing slot.",
			},
		},
	},
	play: async ({ canvas }) => {
		const title = canvas.getByText("Rewrite the changelog parser")

		await expect(getComputedStyle(title).fontWeight).toBe("400")
		await expect(canvas.getByText("09:12")).toBeVisible()
	},
})
