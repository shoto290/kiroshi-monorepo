import type { CSSProperties, ReactNode } from "react"
import { expect, fn, screen } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	companionGlyphsIn,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { Icons } from "@workspace/ui/components/icons"
import type {
	MissionCardModel,
	MissionState,
} from "@workspace/ui/components/mission"
import {
	MissionCard,
	type MissionCardProps,
} from "@workspace/ui/components/mission-card"
import {
	CLOSED_MISSION,
	CLOSED_MISSION_CARD,
	COMMITS_AHEAD_MISSION,
	FAILED_MISSION,
	LONG_MISSION_STATUS,
	MISSION_LAST_ACTIVITY,
	MISSION_NOW,
	MISSION_PULL_REQUEST,
	MISSION_STATES,
	MISSION_STATUS,
	MISSION_TOOL_CALL_SLOTS,
	READY_MISSION,
	UNTICKETED_MISSION,
	WAITING_BOT_MISSION,
	WAITING_HUMAN_MISSION,
	WAITING_MISSION_CARD,
	WORKING_MISSION,
	WORKING_MISSION_CARD,
} from "@workspace/ui/components/missions.fixtures"
import { ROUTINES_PANEL_WIDTH } from "@workspace/ui/components/routines-panel"
import { SidebarListRow } from "@workspace/ui/components/sidebar-list-row"
import { Button } from "@workspace/ui/components/ui/button"
import { Sidebar, SidebarProvider } from "@workspace/ui/components/ui/sidebar"

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

const UNBROKEN_OBJECTIVE =
	"Follow every package this workspace depends on and open a mission for anything touching supercalifragilisticexpialidociousdesigntokensurface."

const UNBROKEN_TARGET =
	"packages/changelog/src/supercalifragilisticexpialidociousreleasenotesparserforeverypackage.ts"

const UNBROKEN_MISSION_CARD = {
	...WAITING_MISSION_CARD,
	objective: UNBROKEN_OBJECTIVE,
	ticket: {
		...WAITING_MISSION_CARD.ticket,
		externalId: "OPE-1042",
		title:
			"Rework the mission thread so a reader can follow a run that spans several days without losing the ticket it answers",
	},
}

const cardIn = (state: MissionState): MissionCardModel => ({
	...WAITING_MISSION_CARD,
	id: `mission-card-${state}`,
	state,
})

const ACTIVITIES = [true, false]

const ROW_STATE_MATRIX = MISSION_STATES.flatMap((state) =>
	ACTIVITIES.map((isWorking) => ({
		...WORKING_MISSION,
		id: `mission-${state}-${isWorking}`,
		state,
		isWorking,
	})),
)

const PANEL_WIDTH = {
	"--sidebar-width": `${ROUTINES_PANEL_WIDTH}px`,
} as CSSProperties

type PanelProps = {
	children: ReactNode
}

const Panel = ({ children }: PanelProps) => (
	<SidebarProvider style={PANEL_WIDTH}>
		<Sidebar collapsible="none">
			<ul className="flex flex-col gap-0.5">{children}</ul>
		</Sidebar>
	</SidebarProvider>
)

const MENU = (
	<Button aria-label="Mission actions" size="icon-xs" variant="ghost">
		<Icons.More />
	</Button>
)

const rowsIn = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="sidebar-menu-button"]',
		),
	)

const rowIn = (canvasElement: HTMLElement) => {
	const [row] = rowsIn(canvasElement)
	if (!row) throw new Error("No mission row rendered")
	return row
}

const previewIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "roster-row-preview")

const partsIn = (canvasElement: HTMLElement) =>
	slotsIn(previewIn(canvasElement), "mission-row-part")

const firstPartIn = (canvasElement: HTMLElement) => {
	const [part] = partsIn(canvasElement)
	if (!part) throw new Error("The preview line writes no part")
	return part
}

const separatorOf = (part: Element) =>
	getComputedStyle(part, "::before").content

const dotIn = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[data-slot="bot-activity-dot"]')

const colorOf = (element: Element) => getComputedStyle(element).color

const weightOf = (element: Element) => getComputedStyle(element).fontWeight

const figuresOf = (element: Element) =>
	getComputedStyle(element).fontVariantNumeric

const centerOf = (element: Element) => {
	const box = element.getBoundingClientRect()
	return document.elementFromPoint(
		box.x + box.width / 2,
		box.y + box.height / 2,
	)
}

const MEDIUM_WEIGHT = "500"

const boxOf = (row: HTMLElement) => {
	const style = getComputedStyle(row)
	return {
		height: row.getBoundingClientRect().height,
		padding: [
			style.paddingTop,
			style.paddingRight,
			style.paddingBottom,
			style.paddingLeft,
		].join(" "),
		gap: style.gap,
		radius: style.borderRadius,
		border: style.borderTopWidth,
	}
}

type LiveActivityCheck = {
	canvasElement: HTMLElement
	isShown: boolean
}

const expectLiveActivity = async ({
	canvasElement,
	isShown,
}: LiveActivityCheck) => {
	const lines = slotsIn(canvasElement, "mission-live-activity")

	if (!isShown) {
		await expect(lines).toHaveLength(0)
		return
	}

	const [line] = lines
	const target = line.lastElementChild as Element
	await expect(lines).toHaveLength(1)
	await expect(line).toHaveTextContent(
		`${MISSION_LAST_ACTIVITY.tool}${MISSION_LAST_ACTIVITY.target}`,
	)
	await expect(separatorOf(target)).toBe('"·"')
	await expect(getComputedStyle(line).whiteSpace).toBe("nowrap")
	await expect(line.getBoundingClientRect().height).toBe(16)
}

const LISTED_BY_THE_PANEL =
	"`packages/ui/src/components/routines-panel.tsx` lists one row per open mission, from the rows `toActivityMissions` in `apps/app/src/lib/missions/missions-model.ts` builds for `apps/app/src/components/thread-routines.tsx`."

const MOUNTED_BY_THE_TURN =
	"`toMissionCard` in `apps/app/src/lib/missions/missions-model.ts` builds this model and `packages/ui/src/components/mission-turn.tsx` mounts the card with it."

const meta = preview.meta({
	title: "Conversation/Missions/MissionCard",
	component: MissionCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"One mission, in one of two densities. `card` is the body of a mission turn: a soft bubble opening on the tools the mission runs with, the pill saying where it stands and the time, then the objective and the ticket it answers; reach for it through `MissionTurn`, which gives it the author line and the gutter avatar. `row` is the `SidebarListRow` the activity panel lists: the companion's blot as leading media, the objective on the name line with the time at its end, the state as the row badge dot, and a preview line writing the tool marks, the platform mark, the ticket, the companion and the state word. Both draw the live tool call while somebody is on the mission, the last status, and the commits ahead with the pull request link. The whole component opens the mission thread; links open on their own. `menu` holds a trailing control at the edge the time sits on.",
			},
		},
	},
	args: { ...WAITING_MISSION_CARD, density: "card" as const, onOpen: fn() },
	render: (args) =>
		args.density === "row" ? (
			<Panel>
				<MissionCard {...args} />
			</Panel>
		) : (
			<MissionCard {...args} />
		),
})

export const CardWaitingHuman = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A mission stopped on a person, against a ticket the app knows. Check that the title row reads the tool marks, the pill and the time before the objective, that the ticket line carries its platform mark, its identifier and its title in the muted foreground, that no live tool call is drawn since nobody is on it, and that Tab reaches the bubble first and the ticket second, each with the ring the repo draws. Pick `CardUnlinkable` for a ticket the app cannot open. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const open = canvas.getByRole("button")

		await userEvent.click(open)
		await expect(args.onOpen).toHaveBeenCalledWith(WAITING_MISSION_CARD.id)

		await userEvent.tab()
		await expect(canvas.getByRole("link")).toHaveFocus()
		await expect(slotsIn(canvasElement, "mission-status")).toHaveLength(0)
		await expect(slotIn(canvasElement, "mission-timestamp")).toHaveTextContent(
			WAITING_MISSION_CARD.timestamp,
		)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const CardWorking = meta.story({
	args: WORKING_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission somebody is live on, which `apps/app/src/lib/missions/missions-model.ts` reads off the speakers of its thread and off how long its agent has been running, never off its state. Check that the card carries no pill, that it opens on a word only a screen reader hears saying somebody is on it, and that the last tool call reads under the ticket as the tool, a dot, then its target, on one muted line. Pick `CardWaitingBot` for a mission nobody is on yet. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Working now")).toBeInTheDocument()
		await expect(slotsIn(canvasElement, "mission-state-pill")).toHaveLength(0)
		await expectLiveActivity({ canvasElement, isShown: true })
	},
})

export const CardWaitingBot = meta.story({
	args: { ...cardIn("waiting_bot"), lastActivity: MISSION_LAST_ACTIVITY },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion has not picked it up, still holding the last tool call it recorded. Check that it carries no pill, since it stands nowhere a reader can act on, and that the tool call is not drawn and no room is kept for it, since nobody is on the mission. Pick `CardWorking` for the same card with somebody on it. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-state-pill")).toHaveLength(0)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const CardReadyToMerge = meta.story({
	args: cardIn("ready_to_merge"),
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose work waits to be merged. Check that the pill says so with its done mark, and that no tool call is drawn. Pick `CardActivityLine` for the pull request it waits on. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotIn(canvasElement, "mission-state-pill")).toHaveAttribute(
			"data-state",
			"ready_to_merge",
		)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const CardFailed = meta.story({
	args: cardIn("failed"),
	parameters: {
		docs: {
			description: {
				story:
					"A mission that failed and that nobody has closed. Check that the pill says so in text beside its failed mark, and that no tool call is drawn. Pick `CardDone` for a mission that ran to the end. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotIn(canvasElement, "mission-state-pill")).toHaveAttribute(
			"data-state",
			"failed",
		)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const CardDone = meta.story({
	args: CLOSED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission that ran to the end. Check that the bubble keeps the soft variant of a running one, that only the objective steps back into the muted foreground, and that the time of day it closed ends the title row. Pick `CardWaitingHuman` for the form that has to stand out beside it. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [card] = slotsIn(canvasElement, "mission-card")

		await expect(card).toHaveAttribute("data-closed", "true")
		await expect(canvas.queryByText("Working now")).toBeNull()
		await expect(canvas.getByText("09:12")).toBeVisible()
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const CardUnrecognised = meta.story({
	args: UNRECOGNISED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A ticket from a platform the app ships no mark for, on a tool it does not know either. Check that the identifier and the title are read all the same, that the line still opens the ticket, and that the two stand-in marks cannot be mistaken for one another. Pick `CardWaitingHuman` for the pair the app does recognise.",
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

export const CardIdentifierWithoutTitle = meta.story({
	args: UNTITLED_TICKET_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A ticket the app knows by number and not by name. Check that the line stops after the identifier, with no empty element and no gap held open for the title that is missing. Pick `CardWaitingHuman` for the ticket that carries both.",
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

export const CardWithoutTicket = meta.story({
	args: UNTICKETED_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened against nothing, on no tool, while its companion works on it. Check that the title row holds the time alone, and that no line is held open where the ticket would be. Pick `CardWorking` for the same card with tool marks and a ticket.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-ticket-line")).toHaveLength(0)
		await expect(
			slotIn(canvasElement, "mission-title-row").children,
		).toHaveLength(1)
		await expect(
			canvas.getByText(UNTICKETED_MISSION_CARD.objective),
		).toBeVisible()
	},
})

export const CardUnlinkable = meta.story({
	args: UNLINKABLE_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"The mission carries a ticket the app has no address for. Check that the identifier and the title are still read, as plain text rather than as a link, and that the bubble is then the only keyboard target. Pick `CardWaitingHuman` for the ticket that can be opened.",
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

export const CardActivityLine = meta.story({
	args: { commitsAhead: 3, pullRequest: MISSION_PULL_REQUEST },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose branch is ahead of its base and has a pull request open. Check that the last line reads the commits ahead in tabular figures, then the pull request as a link of its own that opens in the browser. Pick `CardWaitingHuman` for a mission with neither. " +
					MOUNTED_BY_THE_TURN,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const line = slotIn(canvasElement, "mission-activity")

		await expect(slotIn(line, "mission-commits-ahead")).toHaveTextContent(
			"3 commits ahead",
		)
		await expect(slotIn(line, "mission-link")).toHaveAttribute(
			"href",
			MISSION_PULL_REQUEST.url,
		)
	},
})

export const CardLongContent = meta.story({
	args: {
		...UNBROKEN_MISSION_CARD,
		isWorking: true,
		lastActivity: { tool: "Edit", target: UNBROKEN_TARGET },
	},
	parameters: {
		docs: {
			description: {
				story:
					"An objective, a ticket title and a tool call target that each hold a string longer than the bubble, in a container squeezed to 320 pixels. Check that the objective and the title break instead of overflowing, that the target is cut on an ellipsis on its one line, and that nothing scrolls sideways at 200 percent zoom.",
			},
		},
	},
	render: (args) => (
		<div className="w-80 max-w-full">
			<MissionCard {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const container = canvasElement.querySelector(".w-80") as HTMLElement
		const live = slotIn(canvasElement, "mission-live-activity")

		await expect(live.scrollWidth).toBeGreaterThan(live.clientWidth)
		await expect(container.scrollWidth).toBeLessThanOrEqual(
			container.clientWidth,
		)
		await expect(
			slotIn(canvasElement, "mission-card").getBoundingClientRect().right,
		).toBeLessThanOrEqual(container.getBoundingClientRect().right)
	},
})

const TOOLTIP_WAIT_MS = 400

const SHORT_OBJECTIVE_MISSION_CARD = {
	...UNTICKETED_MISSION_CARD,
	objective: "Ship the status line",
	lastActivity: undefined,
}

export const CardWithStatus = meta.story({
	args: { status: MISSION_STATUS, now: MISSION_NOW },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion wrote a last status. Check that it reads below the objective and the ticket line, in the muted foreground, with its relative time after it in tabular figures, and that the bubble stays the one target that opens the mission and raises no tooltip. Pick `CardWaitingHuman` for the card with no status.",
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
		await expect(open).toHaveAccessibleName(
			`Open the mission: ${WAITING_MISSION_CARD.objective}`,
		)
		await userEvent.hover(open)
		await new Promise((resolve) => setTimeout(resolve, TOOLTIP_WAIT_MS))
		await expect(screen.queryByRole("tooltip")).toBeNull()
		await expect(centerOf(status)).toBe(open)
	},
})

export const CardLongStatus = meta.story({
	args: {
		...SHORT_OBJECTIVE_MISSION_CARD,
		status: LONG_MISSION_STATUS,
		now: MISSION_NOW,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A status written as several sentences ending on an unbroken string, beside the same card with no status. Check that the status stops after three lines on an ellipsis, that its bubble widens to the widest a bubble takes and no further while the card without it keeps the width its objective gives it, and that hovering the bubble raises no tooltip. Pick `CardWithStatus` for a status that fits.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-80 max-w-full flex-col items-start gap-4">
			<MissionCard {...args} />
			<MissionCard
				{...SHORT_OBJECTIVE_MISSION_CARD}
				density="card"
				onOpen={args.onOpen}
			/>
		</div>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const [withStatus, withoutStatus] = slotsIn(
			canvasElement,
			"message-bubble-content",
		)
		const [text] = slotIn(canvasElement, "mission-status").children
		const widthOf = (element: Element) => element.getBoundingClientRect().width
		const maximumOf = (content: Element) =>
			widthOf(content.parentElement as Element)

		await expect(widthOf(withStatus)).toBe(maximumOf(withStatus))
		await expect(widthOf(withoutStatus)).toBeLessThan(maximumOf(withoutStatus))
		await expect(text.scrollHeight).toBeGreaterThan(text.clientHeight)
		await expect(getComputedStyle(text).webkitLineClamp).toBe("3")

		const status = slotIn(canvasElement, "mission-status")
		await expect(status.getBoundingClientRect().right).toBeLessThanOrEqual(
			withStatus.getBoundingClientRect().right,
		)
		await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth)

		const [open] = canvas.getAllByRole("button")
		await userEvent.hover(open)
		await new Promise((resolve) => setTimeout(resolve, TOOLTIP_WAIT_MS))
		await expect(screen.queryByRole("tooltip")).toBeNull()
	},
})

export const RowWorking = meta.story({
	args: { ...WORKING_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission somebody is live on. Check that the blot holds the working pose the same mission carries on its thread card, that no badge dot is drawn on it, that the preview line opens on a word only a screen reader hears, runs the working shimmer and stops after the companion name, that the identifier keeps the medium weight and the tabular figures while the companion stays at the line's own weight, that the last tool call reads under it as the tool, a dot, then its target, and that the row reports the mission it belongs to when it is pressed. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(companionGlyphsIn(canvasElement, "working")[0]).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("1h")).toBeVisible()

		const line = previewIn(canvasElement)
		const identifier = canvas.getByText("OPE-42")
		await expect(line.firstElementChild).toHaveAttribute(
			"data-slot",
			"text-shimmer",
		)
		await expect(figuresOf(identifier)).toBe("tabular-nums")
		await expect(weightOf(identifier)).toBe(MEDIUM_WEIGHT)
		await expect(
			partsIn(canvasElement).map((part) => part.textContent),
		).toEqual(["OPE-42", "Ada Martin"])
		await expect(canvas.getByText("Working now")).toBeInTheDocument()
		await expect(
			canvas.getByRole("img", { name: WORKING_MISSION.tools[0] }),
		).toBeVisible()
		await expect(slotsIn(canvasElement, "mission-status")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "mission-activity")).toHaveLength(0)
		await expectLiveActivity({ canvasElement, isShown: true })

		const name = canvas.getByText("Ada Martin")
		await expect(figuresOf(name)).toBe("normal")
		await expect(weightOf(name)).toBe(weightOf(line))
		await expect(colorOf(name)).toBe(colorOf(line))

		await expect(rowIn(canvasElement)).toHaveAttribute(
			"data-opens",
			WORKING_MISSION.id,
		)
		await userEvent.click(canvas.getByText(WORKING_MISSION.objective))
		await expect(args.onOpen).toHaveBeenCalledWith(WORKING_MISSION.id)
	},
})

export const RowWaitingBot = meta.story({
	args: {
		...WAITING_BOT_MISSION,
		density: "row",
		lastActivity: MISSION_LAST_ACTIVITY,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion has not picked it up yet, on a platform that names no identifier, still holding the last tool call it recorded. Check that no badge dot is drawn, that the blot rests, that the ticket title takes the place of the missing identifier, that the line names no state and stays on one line cut rather than wrapped, and that no tool call line is drawn nor room kept for it. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const line = previewIn(canvasElement)

		await expect(dotIn(canvasElement)).toBeNull()
		await expect(companionGlyphsIn(canvasElement, "idle")[0]).toBeVisible()
		await expect(firstPartIn(canvasElement)).toHaveTextContent(
			WAITING_BOT_MISSION.ticket.title,
		)
		await expect(partsIn(canvasElement)).toHaveLength(2)
		await expect(getComputedStyle(line).whiteSpace).toBe("nowrap")
		await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth)
		await expectLiveActivity({ canvasElement, isShown: false })
		await expect(boxOf(rowIn(canvasElement)).height).toBe(48)
	},
})

export const RowWaitingHuman = meta.story({
	args: { ...WAITING_HUMAN_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission stopped on a question only a person can answer. Check that the attention dot is drawn on the row, and that the wait is written once in text at the end of the preview line. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute(
			"data-badge",
			"attention",
		)
		await expect(canvas.getAllByText("Blocked on you")).toHaveLength(1)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const RowReadyToMerge = meta.story({
	args: { ...READY_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose work is done and waiting to be merged. Check that the done dot replaces the attention one rather than adding to it, and that the state word is written once. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute("data-badge", "done")
		await expect(canvas.getAllByText("Ready to merge")).toHaveLength(1)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const RowFailed = meta.story({
	args: { ...FAILED_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission that failed and that nobody has closed. Check that it keeps an open mission's row, that the failed dot sets it apart, and that the state word says so in text as well. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute("data-badge", "failed")
		await expect(canvas.getByText("Blocked")).toBeVisible()
		await expect(canvas.getByText("3d")).toBeVisible()
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const RowDone = meta.story({
	args: { ...CLOSED_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission closed earlier today. Check that the blot rests, that the objective drops to the muted foreground the preview line already reads in, that no badge dot is drawn, that the time of day it closed takes the place of an age, and that the state word says it is done. `packages/ui/src/components/routines-panel.tsx` lists the missions that closed earlier today.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(companionGlyphsIn(canvasElement, "idle")[0]).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("09:12")).toBeVisible()
		await expect(canvas.getByText("Completed")).toBeVisible()
		await expect(colorOf(slotIn(canvasElement, "roster-row-name"))).toBe(
			colorOf(previewIn(canvasElement)),
		)
		await expectLiveActivity({ canvasElement, isShown: false })
	},
})

export const RowStates = meta.story({
	args: { density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"The six states a mission can be in, each drawn twice: with a companion live on it, then with nobody on it. Check that the row of each pair somebody is on opens on the word only a screen reader hears and carries the tool call line, that the preview line closes on a state word for the four states a reader can act on, that the blot turns in the first row of each pair and rests in the second, and that the badge dot keeps following the state rather than the work. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	render: (args) => (
		<Panel>
			{ROW_STATE_MATRIX.map((mission) => (
				<MissionCard {...args} {...mission} key={mission.id} />
			))}
		</Panel>
	),
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getAllByText("Working now")).toHaveLength(
			MISSION_STATES.length,
		)
		await expect(slotsIn(canvasElement, "mission-live-activity")).toHaveLength(
			MISSION_STATES.length,
		)
		await expect(companionGlyphsIn(canvasElement, "working")).toHaveLength(
			MISSION_STATES.length,
		)
		await expect(companionGlyphsIn(canvasElement, "idle")).toHaveLength(
			MISSION_STATES.length,
		)
		await expect(canvas.getAllByText("Blocked on you")).toHaveLength(
			ACTIVITIES.length,
		)
	},
})

export const RowPartsRepeatingTheSameWords = meta.story({
	args: {
		...WAITING_BOT_MISSION,
		density: "row",
		ticket: {
			...WAITING_BOT_MISSION.ticket,
			title: WAITING_BOT_MISSION.identity.name,
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"A ticket titled after the companion running it, so the line writes the same words twice. Check that both parts are drawn, the second opened by its own separator, and that no separator is left hanging where the state part used to close the line. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [ticket, ...opened] = partsIn(canvasElement)
		if (!ticket) throw new Error("The preview line writes no part")

		await expect(
			canvas.getAllByText(WAITING_BOT_MISSION.identity.name),
		).toHaveLength(2)
		await expect(separatorOf(ticket)).toBe("none")
		for (const part of opened) await expect(separatorOf(part)).toBe('"·"')
	},
})

export const RowWithoutATicket = meta.story({
	args: { ...UNTICKETED_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened with no ticket and no tool, which the store keeps as empty strings rather than as nothing. Check that the preview line opens on the companion name, with no mark in front of it and no separator before it. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const first = firstPartIn(canvasElement)

		await expect(first).toHaveTextContent(UNTICKETED_MISSION.identity.name)
		await expect(previewIn(canvasElement).querySelector("svg")).toBeNull()
		await expect(separatorOf(first)).toBe("none")
	},
})

export const RowActivityLine = meta.story({
	args: {
		...COMMITS_AHEAD_MISSION,
		density: "row",
		pullRequest: MISSION_PULL_REQUEST,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose branch is ahead of its base and has a pull request open. Check that the last muted line reads the commits ahead in tabular figures then the pull request link, under the live tool call and aligned with the preview line, that a press on the commits still lands on the row, and that the row itself holds no second keyboard target. Pick `RowWorking` for a row with neither, which draws no such line. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const line = slotIn(canvasElement, "mission-activity")
		const commits = slotIn(line, "mission-commits-ahead")

		for (const slot of MISSION_TOOL_CALL_SLOTS) {
			await expect(slotsIn(line, slot)).toHaveLength(0)
		}
		await expect(commits).toHaveTextContent("3 commits ahead")
		await expect(figuresOf(commits)).toBe("tabular-nums")
		await expect(colorOf(line)).toBe(colorOf(previewIn(canvasElement)))
		await expect(line.getBoundingClientRect().height).toBe(16)
		await expect(slotIn(line, "mission-link")).toHaveAttribute(
			"href",
			MISSION_PULL_REQUEST.url,
		)
		await expect(
			rowIn(canvasElement).querySelectorAll("[tabindex], button, a"),
		).toHaveLength(0)
		await expect(rowIn(canvasElement).contains(centerOf(commits))).toBe(true)

		const lineBox = line.getBoundingClientRect()
		const previewBox = previewIn(canvasElement).getBoundingClientRect()
		await expect(lineBox.left).toBe(previewBox.left)
		await expect(lineBox.top).toBe(
			slotIn(canvasElement, "mission-live-activity").getBoundingClientRect()
				.bottom,
		)
		await expect(lineBox.bottom).toBeLessThanOrEqual(
			rowIn(canvasElement).getBoundingClientRect().bottom,
		)
	},
})

export const RowLongContent = meta.story({
	args: {
		...WORKING_MISSION,
		density: "row",
		objective: UNBROKEN_OBJECTIVE,
		lastActivity: { tool: "Edit", target: UNBROKEN_TARGET },
	},
	parameters: {
		docs: {
			description: {
				story:
					"An unbroken objective and an unbroken tool call target, in a panel at its 320px width. Check that the objective, the line under it and the tool call each stay on one line and end in an ellipsis, that the row keeps its height, and that the blot is not squeezed to make room for them. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const objective = canvas.getByText(UNBROKEN_OBJECTIVE)
		const line = previewIn(canvasElement)
		const live = slotIn(canvasElement, "mission-live-activity")
		const row = rowIn(canvasElement)

		for (const clipped of [objective, live]) {
			await expect(clipped.scrollWidth).toBeGreaterThan(clipped.clientWidth)
		}
		for (const clipped of [objective, line, live]) {
			await expect(getComputedStyle(clipped).textOverflow).toBe("ellipsis")
			await expect(clipped.getBoundingClientRect().right).toBeLessThanOrEqual(
				row.getBoundingClientRect().right,
			)
		}
		await expect(objective.clientHeight).toBe(20)
		await expect(boxOf(row).height).toBe(64)
		await expect(
			slotIn(canvasElement, "bot-identity-avatar").getBoundingClientRect()
				.width,
		).toBe(32)
	},
})

export const RowWithStatus = meta.story({
	args: {
		...WAITING_HUMAN_MISSION,
		density: "row",
		status: MISSION_STATUS,
		now: MISSION_NOW,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion wrote a last status. Check that it closes the preview line after the dot the other parts are separated by, that the line draws no time for it while its markup holds the time for assistive technology, that the timestamp slot keeps the time it had, that its tooltip hands the text and its relative time over, and that the row stays the one keyboard target. Pick `RowWaitingHuman` for a row with no status.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const line = previewIn(canvasElement)
		const status = slotIn(line, "mission-status")

		await expect(line.lastElementChild).toBe(status)
		await expect(status).toHaveTextContent(MISSION_STATUS.text)
		await expect(separatorOf(status)).toBe(
			separatorOf(partsIn(canvasElement)[1]),
		)
		const time = slotIn(status, "mission-status-time")
		await expect(time).toHaveAttribute(
			"datetime",
			new Date(MISSION_STATUS.writtenAt).toISOString(),
		)
		await expect(getComputedStyle(time).clipPath).toBe("inset(50%)")
		await expect(line.getBoundingClientRect().height).toBe(16)
		await expect(
			canvas.getByText(WAITING_HUMAN_MISSION.timestamp),
		).toBeVisible()
		await expect(
			rowIn(canvasElement).querySelectorAll("[tabindex], button, a"),
		).toHaveLength(0)

		await userEvent.hover(status)
		const tip = await screen.findByRole("tooltip")
		await expect(tip).toHaveTextContent(MISSION_STATUS.text)
		await expect(tip).toHaveTextContent("4 minutes ago")

		await userEvent.click(status)
		await expect(args.onOpen).toHaveBeenCalledWith(WAITING_HUMAN_MISSION.id)
	},
})

export const RowLongStatus = meta.story({
	args: {
		...WAITING_HUMAN_MISSION,
		density: "row",
		status: LONG_MISSION_STATUS,
		now: MISSION_NOW,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A status written as several sentences, in a row of the width the activity panel gives it. Check that the preview line stays one line high and cuts on an ellipsis, that the timestamp slot stays whole, and that the tooltip raised from the status hands the whole text over. Pick `RowWithStatus` for a status that fits.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const line = previewIn(canvasElement)
		const status = slotIn(line, "mission-status")

		await expect(line.getBoundingClientRect().height).toBe(16)
		await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth)
		await expect(
			canvas.getByText(WAITING_HUMAN_MISSION.timestamp),
		).toBeVisible()

		await userEvent.hover(status)
		await expect(await screen.findByRole("tooltip")).toHaveTextContent(
			LONG_MISSION_STATUS.text,
		)
	},
})

export const RowBoxMatchesARosterRow = meta.story({
	tags: ["test-only"],
	args: { ...WORKING_MISSION, density: "row", lastActivity: undefined },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The mission row beside the roster row of the left sidebar, both drawn by `SidebarListRow`. Check that the two boxes share their padding, their leading gap, their corner and their borderless edge, and that only the height differs: 48px on the mission avatar against the 52px the roster draws on its 40px one.",
			},
		},
	},
	render: (args) => (
		<Panel>
			<MissionCard {...args} />
			<li>
				<SidebarListRow
					media={<BotIdentityAvatar name="Atlas" seed="atlas" size={40} />}
					name="Atlas"
					preview="Pulled the papers for the brief."
					timestamp="09:24"
				/>
			</li>
		</Panel>
	),
	play: async ({ canvasElement }) => {
		const [mission, roster] = rowsIn(canvasElement)
		if (!mission || !roster) throw new Error("Both rows are not rendered")

		const missionBox = boxOf(mission)
		const rosterBox = boxOf(roster)

		await expect(missionBox.padding).toBe("6px 12px 6px 6px")
		await expect(missionBox.gap).toBe("10px")
		await expect(missionBox).toEqual({
			...rosterBox,
			height: missionBox.height,
		})
		await expect(missionBox.height).toBe(48)
		await expect(rosterBox.height).toBe(52)
	},
})

type OpenCheck = {
	canvas: { getByRole: (role: "button") => HTMLElement }
	objective: HTMLElement
	onOpen: MissionCardProps["onOpen"]
	id: string
}

const expectOpensFromAnywhere = async ({
	canvas,
	objective,
	onOpen,
	id,
}: OpenCheck) => {
	const hit = centerOf(objective) as HTMLElement

	await expect(canvas.getByRole("button").contains(hit)).toBe(true)
	hit.click()
	await expect(onOpen).toHaveBeenLastCalledWith(id)
}

export const RowOpensFromAnywhere = meta.story({
	tags: ["test-only"],
	args: { ...WORKING_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"The row pressed on its objective, then reached by Tab and pressed with Enter. Check that both report the mission id, and that the focused row draws its ring.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expectOpensFromAnywhere({
			canvas,
			objective: canvas.getByText(WORKING_MISSION.objective),
			onOpen: args.onOpen,
			id: WORKING_MISSION.id,
		})

		await userEvent.tab()
		const open = canvas.getByRole("button")
		await expect(open).toHaveFocus()
		await expect(getComputedStyle(open).boxShadow).not.toBe("none")
		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)
		await expect(args.onOpen).toHaveBeenLastCalledWith(WORKING_MISSION.id)
	},
})

export const CardOpensFromAnywhere = meta.story({
	tags: ["test-only"],
	args: WORKING_MISSION_CARD,
	parameters: {
		docs: {
			description: {
				story:
					"The card pressed on its objective, then reached by Tab and pressed with Enter. Check that both report the mission id, and that the focused bubble draws its ring.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expectOpensFromAnywhere({
			canvas,
			objective: canvas.getByText(WORKING_MISSION_CARD.objective),
			onOpen: args.onOpen,
			id: WORKING_MISSION_CARD.id,
		})

		await userEvent.tab()
		const open = canvas.getByRole("button")
		await expect(open).toHaveFocus()
		await expect(getComputedStyle(open).boxShadow).not.toBe("none")
		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)
		await expect(args.onOpen).toHaveBeenLastCalledWith(WORKING_MISSION_CARD.id)
	},
})

type PullRequestCheck = {
	canvasElement: HTMLElement
	onOpen: MissionCardProps["onOpen"]
}

const expectPullRequestOpensAlone = async ({
	canvasElement,
	onOpen,
}: PullRequestCheck) => {
	const link = slotIn(canvasElement, "mission-link")
	const clicked: EventTarget[] = []
	link.addEventListener("click", (event) => {
		clicked.push(event.currentTarget as EventTarget)
		event.preventDefault()
	})

	await expect(link).toHaveAttribute("href", MISSION_PULL_REQUEST.url)
	await expect(link).toHaveAttribute("target", "_blank")
	await expect(link.contains(centerOf(link))).toBe(true)
	;(centerOf(link) as HTMLElement).click()
	await expect(clicked).toEqual([link])
	await expect(onOpen).not.toHaveBeenCalled()
}

export const RowPullRequestOpensAlone = meta.story({
	tags: ["test-only"],
	args: {
		...COMMITS_AHEAD_MISSION,
		density: "row",
		pullRequest: MISSION_PULL_REQUEST,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The pull request link of a row pressed. Check that the press reaches the link, which opens in the browser, and never the row.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		await expectPullRequestOpensAlone({ canvasElement, onOpen: args.onOpen })
	},
})

export const CardPullRequestOpensAlone = meta.story({
	tags: ["test-only"],
	args: { commitsAhead: 3, pullRequest: MISSION_PULL_REQUEST },
	parameters: {
		docs: {
			description: {
				story:
					"The pull request link of a card pressed. Check that the press reaches the link, which opens in the browser, and never the bubble.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		await expectPullRequestOpensAlone({ canvasElement, onOpen: args.onOpen })
	},
})

type MenuCheck = {
	withMenu: HTMLElement
	withoutMenu: HTMLElement
	timestampSlot: string
}

const expectMenuHoldsNoRoom = async ({
	withMenu,
	withoutMenu,
	timestampSlot,
}: MenuCheck) => {
	const menu = slotIn(withMenu, "mission-menu")
	const boxesOf = (root: HTMLElement) =>
		[
			slotIn(root, timestampSlot),
			root.querySelector(
				"[data-slot=mission-objective], [data-slot=roster-row-name]",
			),
		].map((element) => {
			const box = (element as Element).getBoundingClientRect()
			return { width: box.width, height: box.height, x: box.x }
		})

	await expect(slotsIn(withoutMenu, "mission-menu")).toHaveLength(0)
	await expect(boxesOf(withMenu)).toEqual(boxesOf(withoutMenu))
	await expect(
		Math.abs(
			menu.getBoundingClientRect().right -
				slotIn(withMenu, timestampSlot).getBoundingClientRect().right,
		),
	).toBeLessThanOrEqual(1)

	await expect(getComputedStyle(menu).opacity).toBe("0")
	menu.querySelector("button")?.focus()
	await expect(getComputedStyle(menu).opacity).toBe("1")
	await expect(
		getComputedStyle(slotIn(withMenu, timestampSlot)).visibility,
	).toBe("hidden")
}

export const RowMenuHoldsNoRoom = meta.story({
	tags: ["test-only"],
	args: { ...WAITING_HUMAN_MISSION, density: "row" },
	parameters: {
		docs: {
			description: {
				story:
					"The same row with a trailing menu and without one. Check that the row without it draws no menu slot, that the time and the objective sit where they sit on the row without it, that the menu sits at the trailing edge of the time, and that hovering or focusing the row shows the menu in place of the time.",
			},
		},
	},
	render: (args) => (
		<Panel>
			<MissionCard {...args} menu={MENU} />
			<MissionCard {...args} id="mission-without-menu" />
		</Panel>
	),
	play: async ({ canvasElement }) => {
		const [withMenu, withoutMenu] = slotsIn(canvasElement, "mission-row")

		await expectMenuHoldsNoRoom({
			withMenu,
			withoutMenu,
			timestampSlot: "roster-row-timestamp",
		})
	},
})

export const CardMenuHoldsNoRoom = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"The same card with a trailing menu and without one. Check that the card without it draws no menu slot, that the time and the objective sit where they sit on the card without it, that the menu sits at the trailing edge of the time, and that hovering or focusing the bubble shows the menu in place of the time.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-md flex-col gap-4">
			<MissionCard {...args} menu={MENU} />
			<MissionCard {...args} id="mission-without-menu" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const [withMenu, withoutMenu] = slotsIn(canvasElement, "message-bubble")

		await expectMenuHoldsNoRoom({
			withMenu,
			withoutMenu,
			timestampSlot: "mission-timestamp",
		})
	},
})
