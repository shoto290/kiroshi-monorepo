import { expect, fn, screen } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn, slotsIn } from "@workspace/storybook/story-utils"
import { MissionCard } from "@workspace/ui/components/mission-card"
import {
	CLOSED_MISSION_CARD,
	LONG_MISSION_STATUS,
	MISSION_STATUS,
	WAITING_MISSION_CARD,
	WORKING_MISSION_CARD,
} from "@workspace/ui/components/missions.fixtures"

const UNRECOGNISED_MISSION_CARD = {
	...WORKING_MISSION_CARD,
	tools: ["Screenshot"],
}

const UNTITLED_TICKET_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	ticket: { ...WAITING_MISSION_CARD.ticket, title: "" },
}

const UNTICKETED_MISSION_CARD = {
	...WORKING_MISSION_CARD,
	tools: [],
	ticket: { platform: "", externalId: "", title: "", url: "" },
}

const UNLINKABLE_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	ticket: { ...WAITING_MISSION_CARD.ticket, url: "" },
}

const UNBROKEN_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	objective:
		"Follow every package this workspace depends on and open a mission for anything touching supercalifragilisticexpialidociousdesigntokensurface.",
	ticket: {
		...WAITING_MISSION_CARD.ticket,
		externalId: "OPE-1042",
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
					"The body of a mission turn: a soft bubble opening on the tools the mission runs with and, for the states a reader can act on, the pill saying where it stands, then the objective and the ticket it answers. A mission being worked on carries no pill, and opens on its tool marks alone. The whole bubble opens the mission thread, the ticket line opens the ticket in the browser, and the two are separate keyboard targets. Reach for it through `MissionTurn`, which gives it the author line and the gutter it belongs to.",
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
					"A running mission against a ticket the app knows. Check that the title row reads before the objective, that the ticket line carries its platform mark, its identifier and its title in the muted foreground, that the bubble darkens under the pointer as the target it is, and that Tab reaches the bubble first and the ticket second, each with the ring the repo draws. Pick `Unlinkable` for a mission whose ticket the app cannot open. `apps/app/src/lib/missions/missions-model.ts:204` builds this model out of the stored mission and `packages/ui/src/components/mission-turn.tsx:16` mounts the card with it.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const open = canvas.getByRole("button")

		await userEvent.click(open)
		await expect(args.onOpen).toHaveBeenCalledWith(WAITING_MISSION_CARD.id)

		open.focus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)

		await userEvent.tab()
		await expect(canvas.getByRole("link")).toHaveFocus()
		await expect(slotsIn(canvasElement, "mission-status")).toHaveLength(0)
	},
})

export const Unrecognised = meta.story({
	args: UNRECOGNISED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A ticket from a platform the app ships no mark for, on a tool it does not know either, since the companion that opens a mission names both itself. Check that the identifier and the title are read all the same, that the line still opens the ticket, and above all that the two stand-in marks cannot be mistaken for one another — the ticket is bookmarked, the tool is a tool. Pick `Default` for the pair the app does recognise. The platform and the tools are the strings the store holds, copied as they are by `apps/app/src/lib/missions/missions-model.ts:209`.",
			},
		},
	},
	play: async ({ canvas }) => {
		const ticket = canvas.getByRole("link")

		await expect(ticket).toHaveTextContent(
			UNRECOGNISED_MISSION_CARD.ticket.externalId,
		)
		await expect(ticket).toHaveTextContent(
			UNRECOGNISED_MISSION_CARD.ticket.title,
		)
		await expect(canvas.getByRole("img", { name: "Screenshot" })).toBeVisible()
	},
})

export const IdentifierWithoutTitle = meta.story({
	args: UNTITLED_TICKET_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A ticket the app knows by number and not by name, which is what a mission opened before its ticket was written carries. Check that the line stops after the identifier, with no empty element and no gap held open for the title that is missing. Pick `Default` for the ticket that carries both. `apps/app/src/lib/missions/missions-model.ts:211` passes the stored title through, empty included.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [ticket] = slotsIn(canvasElement, "mission-ticket-line")
		const empty = [...ticket.querySelectorAll("span")].filter(
			(span) => span.textContent === "",
		)

		await expect(ticket).toHaveTextContent(
			UNTITLED_TICKET_MISSION_CARD.ticket.externalId,
		)
		await expect(empty).toHaveLength(0)
	},
})

export const WithoutTicket = meta.story({
	args: UNTICKETED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened against nothing, on no tool, while its companion works on it: nothing is left for a title row to hold. Check that the bubble opens straight on the objective, with no row above it and no line held open where the ticket would be. Pick `Default` for the same card with a pill, a tool mark and a ticket. `apps/app/src/lib/missions/missions-model.ts:209` passes an empty ticket through for a mission opened outside a tracker.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-ticket-line")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "mission-title-row")).toHaveLength(0)
		await expect(
			canvas.getByText(UNTICKETED_MISSION_CARD.objective),
		).toBeVisible()
	},
})

export const Unlinkable = meta.story({
	args: UNLINKABLE_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"The mission carries a ticket the app has no address for. Check that the identifier and the title are still read, as plain text rather than as a link that would take the reader nowhere, and that the bubble is then the only keyboard target. Pick `Default` for the ticket that can be opened. `apps/app/src/lib/missions/missions-model.ts:213` passes the stored url through, empty included.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [ticket] = slotsIn(canvasElement, "mission-ticket-line")

		await expect(ticket).toHaveTextContent(
			UNLINKABLE_MISSION_CARD.ticket.externalId,
		)
		await expect(ticket).toHaveTextContent(UNLINKABLE_MISSION_CARD.ticket.title)
		await expect(canvas.queryByRole("link")).toBeNull()
	},
})

export const Live = meta.story({
	args: WORKING_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission somebody is live on, which `apps/app/src/lib/missions/missions-model.ts` reads off the speakers of its thread and off how long its agent has been running, never off its state. Check that the card carries no pill, since a mission being worked on stands nowhere a reader can act on, and that it opens on a word only a screen reader hears saying somebody is on it, the text alternative of the turning blot `MissionTurn` draws beside it. Pick `Default` for the card of a mission nobody is on.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const live = canvas.getByText("Working now")

		await expect(live).toBeInTheDocument()
		await expect(slotsIn(canvasElement, "mission-state-pill")).toHaveLength(0)
	},
})

export const Closed = meta.story({
	args: CLOSED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission that ran to the end. Check that the bubble keeps the soft variant of a running one — a closed mission is still part of the transcript — and that only the objective steps back into the muted foreground. Pick `Default` for the form that has to stand out beside it. `apps/app/src/lib/missions/missions-model.ts:217` marks the card closed once the mission carries a `closedAt`.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [card] = slotsIn(canvasElement, "mission-card")

		await expect(card).toHaveAttribute("data-closed", "true")
		await expect(canvas.queryByText("Working now")).toBeNull()
	},
})

export const LongContent = meta.story({
	args: UNBROKEN_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"An objective and a ticket title that each hold a string longer than the bubble, in a container squeezed to 320 pixels. Check that both break instead of overflowing, that the identifier stays whole on the line it opens, that the bubble grows taller rather than wider, and that nothing scrolls sideways at 200 percent zoom. The objective and the ticket title are the stored strings `apps/app/src/lib/missions/missions-model.ts:208` copies, which nothing shortens.",
			},
		},
	},
	render: (args) => (
		<div className="w-80 max-w-full">
			<MissionCard {...args} />
		</div>
	),
})

const SHORT_OBJECTIVE_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	objective: "Ship the status line",
}

export const WithStatus = meta.story({
	args: { status: MISSION_STATUS },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion wrote a last status. Check that it reads below the objective and the ticket line, in the muted foreground at the size of the ticket line, with its relative time after it in tabular figures, that it carries no pill and no colour of its own, and that the bubble stays the one target that opens the mission while its tooltip hands the status over. Pick `Default` for the card with no status. Nothing on main feeds this prop yet.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const status = slotIn(canvasElement, "mission-status")
		const time = slotIn(status, "mission-status-time")

		await expect(status).toHaveTextContent(MISSION_STATUS.text)
		await expect(time.tagName).toBe("TIME")
		await expect(time).toHaveAttribute(
			"datetime",
			new Date(MISSION_STATUS.writtenAt).toISOString(),
		)
		await expect(time).toHaveTextContent("4 minutes ago")
		await expect(getComputedStyle(time).fontVariantNumeric).toBe("tabular-nums")

		const open = canvas.getByRole("button")
		await userEvent.hover(open)
		await expect(await screen.findByRole("tooltip")).toHaveTextContent(
			MISSION_STATUS.text,
		)

		const box = status.getBoundingClientRect()
		await expect(
			document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
		).toBe(open)
	},
})

export const LongStatus = meta.story({
	args: { ...SHORT_OBJECTIVE_MISSION_CARD, status: LONG_MISSION_STATUS },
	parameters: {
		docs: {
			description: {
				story:
					"A status written as several sentences ending on an unbroken string, beside the same card with no status. Check that the status stops after three lines on an ellipsis, that the bubble keeps the width the card has without it, and that the tooltip raised from the bubble hands the whole text over. Pick `WithStatus` for a status that fits.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-80 max-w-full flex-col items-start gap-4">
			<MissionCard {...args} />
			<MissionCard {...args} status={undefined} />
		</div>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const [withStatus, withoutStatus] = slotsIn(canvasElement, "message-bubble")
		const [text] = slotIn(canvasElement, "mission-status").children

		await expect(withStatus.getBoundingClientRect().width).toBe(
			withoutStatus.getBoundingClientRect().width,
		)
		await expect(text.scrollHeight).toBeGreaterThan(text.clientHeight)
		await expect(getComputedStyle(text).webkitLineClamp).toBe("3")

		const [open] = canvas.getAllByRole("button")
		await userEvent.hover(open)
		await expect(await screen.findByRole("tooltip")).toHaveTextContent(
			LONG_MISSION_STATUS.text,
		)
	},
})
