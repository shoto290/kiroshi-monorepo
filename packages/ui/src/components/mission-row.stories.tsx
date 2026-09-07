import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { MissionRow } from "@workspace/ui/components/mission-row"
import {
	CLOSED_MISSION,
	FAILED_MISSION,
	READY_MISSION,
	UNTICKETED_MISSION,
	WAITING_BOT_MISSION,
	WAITING_HUMAN_MISSION,
	WORKING_MISSION,
} from "@workspace/ui/components/missions.fixtures"
import { ROUTINES_PANEL_WIDTH } from "@workspace/ui/components/routines-panel"

const LONG_OBJECTIVE =
	"Rewrite the changelog parser so it reads every package of the workspace in one pass"

const dotIn = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[data-slot="bot-activity-dot"]')

const meta = preview.meta({
	title: "Conversation/Missions/MissionRow",
	component: MissionRow,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"One mission of a conversation, as it reads in the activity panel: a bare row with no border and no surface under it, the bot's blot carrying the state as its badge dot, what the mission is for on the first line with the time at the trailing edge, then the platform, the ticket, the bot and the state word on a second line that truncates rather than wraps. The whole row is the way into the mission. Reach for it inside `RoutinesPanel`; on its own it is only useful to check one row's states.",
			},
		},
	},
	args: {
		...WORKING_MISSION,
		onOpen: fn(),
	},
	render: (args) => (
		<ul
			className="flex flex-col gap-0.5"
			style={{ width: ROUTINES_PANEL_WIDTH }}
		>
			<MissionRow {...args} />
		</ul>
	),
})

export const Working = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A mission its bot is working on. Check that the blot holds the working pose the same mission carries on its thread card, that no badge dot is drawn on it, that no state word is added after the bot name, that the ticket identifier and the age read on their own lines, and that the row reports the mission it belongs to when it is pressed.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(
			canvas.getByRole("img", { name: "Bot avatar owl, working" }),
		).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("OPE-42")).toBeVisible()
		await expect(canvas.getByText("Ada Martin")).toBeVisible()
		await expect(canvas.getByText("1h")).toBeVisible()

		await userEvent.click(canvas.getByText(WORKING_MISSION.objective))
		await expect(args.onOpen).toHaveBeenCalled()
	},
})

export const WaitingForItsBot = meta.story({
	args: WAITING_BOT_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose bot has not picked it up yet, on a platform that names no identifier. Check that no badge dot is drawn, that no state word is added, and that the ticket title takes the place of the missing identifier right after the platform mark.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(
			canvas.getByText(WAITING_BOT_MISSION.ticket.title),
		).toBeVisible()
	},
})

export const WaitingOnYou = meta.story({
	args: WAITING_HUMAN_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission stopped on a question only a person can answer. Check that the attention dot is drawn on the blot, that it names the wait for a screen reader rather than leaving colour to carry it alone, and that no state word is written beside the bot name.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute(
			"data-badge",
			"attention",
		)
		await expect(canvas.getByText("Waiting for you")).toBeInTheDocument()
	},
})

export const ReadyToMerge = meta.story({
	args: READY_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose work is done and waiting to be merged. Check that the done dot replaces the attention one rather than adding to it, and that the state word is written once, at the end of the second line, rather than repeated for a screen reader.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute("data-badge", "done")
		await expect(canvas.getAllByText("Ready to merge")).toHaveLength(1)
	},
})

export const Failed = meta.story({
	args: FAILED_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission that failed and that nobody has closed. Check that it keeps an open mission's row rather than being moved out of sight, that the failed dot sets it apart, and that the state word says so in text as well.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute("data-badge", "failed")
		await expect(canvas.getByText("Failed")).toBeVisible()
		await expect(canvas.getByText("3d")).toBeVisible()
	},
})

export const Closed = meta.story({
	args: CLOSED_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission closed earlier today. Check that the blot rests rather than holding the working pose, that the objective drops to the muted colour at regular weight, that no badge dot is drawn on it, that the time of day it closed takes the place of an age, and that the state word says it is done.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByRole("img", { name: "Bot avatar rabbit, idle" }),
		).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("09:12")).toBeVisible()
		await expect(canvas.getByText("Done")).toBeVisible()
	},
})

export const WithoutATicket = meta.story({
	args: UNTICKETED_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened with no ticket at all, which the store keeps as empty strings rather than as nothing. Check that the meta line opens on the bot name with no separator in front of it, and that the bookmark mark still stands for the platform no read named.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const first = slotIn(canvasElement, "activity-row-parts")
			.firstElementChild as HTMLElement

		await expect(first).toHaveTextContent(UNTICKETED_MISSION.bot.name)
		await expect(getComputedStyle(first, "::before").content).toBe("none")
	},
})

export const LongContent = meta.story({
	args: { ...WAITING_HUMAN_MISSION, objective: LONG_OBJECTIVE },
	parameters: {
		docs: {
			description: {
				story:
					"An objective no reader would write, in a panel at its 320px width. Check that the objective and the line under it each stay on one line and end in an ellipsis, that the row keeps its height, and that the badge dot is not squeezed to make room for them.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const objective = canvas.getByText(LONG_OBJECTIVE)
		const row = slotIn(canvasElement, "mission-row")

		await expect(objective.scrollWidth).toBeGreaterThan(objective.clientWidth)
		await expect(row.getBoundingClientRect().height).toBe(52)
		await expect(
			slotIn(canvasElement, "bot-identity-avatar").getBoundingClientRect()
				.width,
		).toBe(32)
	},
})
