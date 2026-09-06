import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	listExhaustively,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import type { MissionState } from "@workspace/ui/components/mission"
import {
	MissionHeader,
	type MissionHeaderProps,
} from "@workspace/ui/components/mission-header"
import {
	MISSION_BOT,
	MISSION_NOW,
	MISSION_OBJECTIVE,
	MISSION_OPENED_AT,
	MISSION_TICKET,
	MISSION_TOOLS,
} from "@workspace/ui/components/missions.fixtures"

const MISSION_STATES = listExhaustively<MissionState>({
	working: true,
	waiting_bot: true,
	waiting_human: true,
	ready_to_merge: true,
	failed: true,
	done: true,
})

const WORKING_HEADER: Omit<MissionHeaderProps, "onBack"> = {
	bot: MISSION_BOT,
	objective: MISSION_OBJECTIVE,
	ticket: MISSION_TICKET,
	tools: MISSION_TOOLS,
	state: "working",
	openedAt: MISSION_OPENED_AT,
	now: MISSION_NOW,
}

const LONG_OBJECTIVE =
	"Rework the mission thread so a reader can follow a run that spans several days without ever losing the ticket it answers"

const meta = preview.meta({
	title: "Conversation/Missions/MissionHeader",
	component: MissionHeader,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The top of a mission thread, in two bands: the way out of it, who runs it, what it was asked to do and where it stands, then the ticket it answers, what it is allowed to reach for and how long it has been open. Reach for it as the header of a mission thread; on its own it is useful to check that a long objective and a long ticket title truncate before the state pill, the tool marks or the opening time lose room.",
			},
		},
	},
	args: { ...WORKING_HEADER, onBack: fn() },
	render: (args) => (
		<div className="w-[36rem] max-w-full">
			<MissionHeader {...args} />
		</div>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A mission a bot is working on right now. Check that the back control is the first thing the keyboard reaches, that the objective titles the thread rather than the bot name, and that the ticket, the tool marks and the opening time read as one line under the avatar.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Back to the conversation" }),
		)

		await expect(args.onBack).toHaveBeenCalled()
	},
})

export const States = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The six states a mission can be in, exhaustively. Check that the pill names each one at the trailing edge of the first band, that only `waiting_human` adds the attention dot to the avatar, and that the two bands keep their height whichever state is drawn.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-[36rem] max-w-full flex-col gap-4">
			{MISSION_STATES.map((state) => (
				<section key={state}>
					<MissionHeader {...args} state={state} />
				</section>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-state-pill")).toHaveLength(
			MISSION_STATES.length,
		)
	},
})

export const TicketLink = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The ticket band on a mission whose ticket carries a url. Check that the link opens in a new tab, that it names the platform, the identifier and the title, and that tabbing to it draws a visible ring. Pick `Empty` for a mission whose ticket names nothing.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const link = canvas.getByRole("link", {
			name: new RegExp(MISSION_TICKET.externalId),
		})

		await expect(link).toHaveAttribute("target", "_blank")
		await expect(link).toHaveAttribute("href", MISSION_TICKET.url)

		await userEvent.tab()
		await userEvent.tab()

		await expect(link).toHaveFocus()
		await expect(link.className).toContain("focus-visible:ring-2")
	},
})

export const Empty = meta.story({
	args: {
		ticket: { externalId: "", title: "", platform: "linear", url: "" },
	},
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened with no ticket behind it. Check that the ticket line and the rule that follows it are left out entirely rather than drawn empty, and that the tool marks keep their place under the avatar with the opening time still on the trailing edge.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-ticket-line")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "mission-ticket-rule")).toHaveLength(0)
	},
})

export const WithoutATool = meta.story({
	args: { tools: [] },
	parameters: {
		docs: {
			description: {
				story:
					"A mission carrying a ticket and no tool. Check that the rule that separates the ticket from the tool marks is left out rather than drawn against nothing, and that the opening time keeps the trailing edge. Pick `Default` for the band that draws both.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-ticket-line")).toHaveLength(1)
		await expect(slotsIn(canvasElement, "mission-ticket-rule")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "mission-tool-mark")).toHaveLength(0)
	},
})

export const LongContent = meta.story({
	args: {
		bot: { ...MISSION_BOT, name: "Anastasia Konstantinopoulou-Whitfield" },
		objective: LONG_OBJECTIVE,
		ticket: {
			...MISSION_TICKET,
			externalId: "OPE-1042",
			title:
				"Rework the mission thread so a reader can follow a run that spans several days without losing the ticket it answers",
		},
		tools: [...MISSION_TOOLS, "Repository read and write", "Screenshot"],
	},
	parameters: {
		docs: {
			description: {
				story:
					"An objective and a ticket title written as sentences, in a container squeezed to 480 pixels. Check that both truncate on one line, that the state pill, every tool mark and the opening time keep their room, and that neither band scrolls sideways. Read it at 200 percent zoom too.",
			},
		},
	},
	render: (args) => (
		<div className="w-[30rem] max-w-full">
			<MissionHeader {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const header = slotIn(canvasElement, "mission-header")
		const objective = slotIn(canvasElement, "mission-objective")

		await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth + 1)
		await expect(objective.scrollWidth).toBeGreaterThan(objective.clientWidth)
	},
})
