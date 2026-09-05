import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn, slotsIn } from "@workspace/storybook/story-utils"
import type { MissionCardModel } from "@workspace/ui/components/mission"
import { MissionTurn } from "@workspace/ui/components/mission-turn"
import {
	CLOSED_MISSION_CARD,
	MISSION_AUTHOR,
	WAITING_MISSION_CARD,
	WORKING_MISSION_CARD,
} from "@workspace/ui/components/missions.fixtures"
import { AssistantTurn, TurnGroup } from "@workspace/ui/components/turn"

const OPENING_ANSWER =
	"That one is wide enough to run on its own, so I opened a mission for it and I will report here when it lands."

const READY_MISSION_CARD: MissionCardModel = {
	...WAITING_MISSION_CARD,
	id: "mission-ope-29",
	state: "ready_to_merge",
}

const FAILED_MISSION_CARD: MissionCardModel = {
	...WAITING_MISSION_CARD,
	id: "mission-ope-17",
	state: "failed",
}

const TOOLLESS_MISSION_CARD: MissionCardModel = {
	...WAITING_MISSION_CARD,
	id: "mission-ope-22",
	tools: [],
}

const UNKNOWN_TOOL_MISSION_CARD: MissionCardModel = {
	...WAITING_MISSION_CARD,
	id: "mission-ope-51",
	tools: ["Screenshot"],
}

const pillMatchesTheBadgeBeforeIt = (canvasElement: HTMLElement) => {
	const badge = slotIn(canvasElement, "bot-title-badge")
	const pill = slotIn(canvasElement, "mission-state-pill")

	return expect(pill.getBoundingClientRect().height).toBe(
		badge.getBoundingClientRect().height,
	)
}

const meta = preview.meta({
	title: "Conversation/Missions/MissionTurn",
	component: MissionTurn,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"A mission as it lands in the transcript it was opened from: an assistant turn like any other, with the bot's own author line above a soft bubble and the bot's avatar in the gutter. The author line carries where the mission stands and which tools it runs with, the bubble carries the objective and the ticket it answers. Reach for it in a conversation feed; the bubble on its own is `MissionCard`.",
			},
		},
	},
	args: { mission: WAITING_MISSION_CARD, onOpen: fn() },
})

export const Working = meta.story({
	args: { mission: WORKING_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"A mission still running, on tools it named itself, against a ticket from a platform the app ships no mark for. Check that the eye reads the state off the avatar working in the gutter rather than off a pill, that a screen reader is still given the word, and that the three tool marks follow the title badge. Pick `WaitingForTheReader` for the state that asks something of the reader.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Working")).toBeInTheDocument()
		await expect(canvas.getByRole("img", { name: "Superset" })).toBeVisible()
	},
})

export const WaitingForTheReader = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The mission stopped on a question for its reader. Check that the pill closes the author line after the tool marks, that it says so in words, that the attention badge sits on the gutter avatar, and that it matches the title badge in height, radius and text size. Pick `Working` for the state that carries no pill at all.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const open = canvas.getByRole("button")
		const ticket = canvas.getByRole("link")

		await pillMatchesTheBadgeBeforeIt(canvasElement)

		await userEvent.click(open)
		await expect(args.onOpen).toHaveBeenCalledWith(WAITING_MISSION_CARD.id)

		ticket.focus()
		await expect(ticket).toHaveFocus()
		await expect(ticket).toHaveAttribute(
			"href",
			WAITING_MISSION_CARD.ticket.url,
		)
	},
})

export const ReadyToMerge = meta.story({
	args: { mission: READY_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"The work is done and waits to be merged. Check that the pill reads as an outline beside the title badge rather than as a colour block, and that the gutter avatar carries no badge — nothing is asked of the reader here. Pick `Done` for the mission that has already been closed.",
			},
		},
	},
})

export const Failed = meta.story({
	args: { mission: FAILED_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"The run stopped on a failure and the mission is still open. Check that the pill names the failure in words as well as in colour, that its tinted form stands as tall as the title badge beside it, and that the objective stays at full contrast because the mission is not closed. Pick `Done` for the closed form.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await pillMatchesTheBadgeBeforeIt(canvasElement)
	},
})

export const Done = meta.story({
	args: { mission: CLOSED_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"A mission that ran to the end and was closed. Check that the bubble keeps its soft variant, that the objective steps back into the muted foreground while the ticket line stays reachable, and that the pill says it is done. Pick `Failed` for a mission that stopped without being closed.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotIn(canvasElement, "mission-card")).toHaveAttribute(
			"data-closed",
			"true",
		)
	},
})

export const WithoutTools = meta.story({
	args: { mission: TOOLLESS_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"A mission that runs on no tool at all. Check that the state pill follows the title badge with nothing between them, and that nothing is drawn in place of the marks. Pick `WithAnUnknownTool` for a mission whose tool has no mark of its own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-tool-mark")).toHaveLength(0)
	},
})

export const WithAnUnknownTool = meta.story({
	args: { mission: UNKNOWN_TOOL_MISSION_CARD },
	parameters: {
		docs: {
			description: {
				story:
					"A tool the app ships no mark for, since the bot that opens a mission names its tools itself. Check that one default mark stands in, that it cannot be mistaken for the Superset, Paper or GitHub marks, and that a screen reader still reads the tool's own name. Pick `Working` for the marks the app does know.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("img", { name: "Screenshot" })).toBeVisible()
	},
})

export const UnderTheTurnThatOpenedIt = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The row as a reader meets it, right under the answer that opened the mission, spaced the way the transcript spaces its rows. Check that the avatar, the author line and the bubble sit on the very same gutter grid as the turn above, and that the bot is named the same way twice rather than in two different shapes.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-6">
			<TurnGroup>
				<AssistantTurn author={MISSION_AUTHOR}>{OPENING_ANSWER}</AssistantTurn>
			</TurnGroup>
			<MissionTurn {...args} />
		</div>
	),
})
