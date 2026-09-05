import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { MissionCard } from "@workspace/ui/components/mission-card"
import {
	CLOSED_MISSION_CARD,
	WAITING_MISSION_CARD,
	WORKING_MISSION_CARD,
} from "@workspace/ui/components/missions.fixtures"

const UNBROKEN_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	objective:
		"Follow every package this workspace depends on and open a mission for anything touching supercalifragilisticexpialidociousdesigntokensurface.",
	ticket: {
		...WAITING_MISSION_CARD.ticket,
		externalId: "OPE-1042-supercalifragilisticexpialidocious",
		title:
			"Rework the mission thread so a reader can follow a run that spans several days without losing the ticket it answers",
	},
}

const meta = preview.meta({
	title: "Conversation/Missions/MissionCard",
	component: MissionCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The body of a mission turn: a soft bubble holding the objective and, under it, the ticket the mission answers. The whole bubble opens the mission thread, the ticket line opens the ticket in the browser, and the two are separate keyboard targets. Reach for it through `MissionTurn`, which gives it the author line and the gutter it belongs to.",
			},
		},
	},
	args: { ...WAITING_MISSION_CARD, onOpen: fn() },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A running mission against a ticket the app knows. Check that the objective reads at full contrast, that the ticket line carries its platform mark, its identifier and its title in the muted foreground, and that Tab reaches the bubble first and the ticket second, each with its own focus ring. Pick `WithoutTicket` for a mission whose ticket the app cannot open.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const open = canvas.getByRole("button")

		await userEvent.click(open)
		await expect(args.onOpen).toHaveBeenCalledWith(WAITING_MISSION_CARD.id)

		open.focus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)

		await userEvent.tab()
		await expect(canvas.getByRole("link")).toHaveFocus()
	},
})

export const WithoutTicket = meta.story({
	args: WORKING_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"The mission answers a ticket on a platform the app ships no mark for, so there is nothing to open. Check that the bubble holds the objective alone, with no empty line under it, and that the bubble is then the only keyboard target. Pick `Default` for the ticket the app can open.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-ticket-line")).toHaveLength(0)
		await expect(canvas.queryByRole("link")).toBeNull()
	},
})

export const Closed = meta.story({
	args: CLOSED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission that ran to the end. Check that the bubble keeps the soft variant of a running one — a closed mission is still part of the transcript — and that only the objective steps back into the muted foreground. Pick `Default` for the form that has to stand out beside it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [card] = slotsIn(canvasElement, "mission-card")

		await expect(card).toHaveAttribute("data-closed", "true")
	},
})

export const LongContent = meta.story({
	args: UNBROKEN_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"An objective and a ticket identifier that each hold a string longer than the bubble, in a container squeezed to 320 pixels. Check that all three of the objective, the identifier and the title break instead of overflowing, that the bubble grows taller rather than wider, and that nothing scrolls sideways at 200 percent zoom.",
			},
		},
	},
	render: (args) => (
		<div className="w-80 max-w-full">
			<MissionCard {...args} />
		</div>
	),
})
