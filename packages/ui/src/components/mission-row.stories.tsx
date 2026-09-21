import type { CSSProperties, ReactNode } from "react"
import { expect, fn, screen } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { MissionRow } from "@workspace/ui/components/mission-row"
import {
	CLOSED_MISSION,
	FAILED_MISSION,
	LONG_MISSION_STATUS,
	MISSION_NOW,
	MISSION_STATES,
	MISSION_STATUS,
	READY_MISSION,
	UNTICKETED_MISSION,
	WAITING_BOT_MISSION,
	WAITING_HUMAN_MISSION,
	WORKING_MISSION,
} from "@workspace/ui/components/missions.fixtures"
import { ROUTINES_PANEL_WIDTH } from "@workspace/ui/components/routines-panel"
import { SidebarListRow } from "@workspace/ui/components/sidebar-list-row"
import { Sidebar, SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const ACTIVITIES = [true, false]

const WORKING_POSE = "Companion avatar owl, working"

const RESTING_POSE = "Companion avatar owl, idle"

const STATE_MATRIX = MISSION_STATES.flatMap((state) =>
	ACTIVITIES.map((isWorking) => ({
		...WORKING_MISSION,
		id: `mission-${state}-${isWorking}`,
		state,
		isWorking,
	})),
)

const LONG_OBJECTIVE =
	"Rewrite the changelog parser so it reads every package of the workspace in one pass"

const PANEL_WIDTH = {
	"--sidebar-width": `${ROUTINES_PANEL_WIDTH}px`,
} as CSSProperties

const Panel = ({ children }: { children: ReactNode }) => (
	<SidebarProvider style={PANEL_WIDTH}>
		<Sidebar collapsible="none">
			<ul className="flex flex-col gap-0.5">{children}</ul>
		</Sidebar>
	</SidebarProvider>
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

const LISTED_BY_THE_PANEL =
	"`packages/ui/src/components/routines-panel.tsx:363` lists one row per open mission, from the rows `apps/app/src/lib/missions/missions-model.ts:174` builds for `apps/app/src/components/thread-routines.tsx:83`."

const meta = preview.meta({
	title: "Conversation/Missions/MissionRow",
	component: MissionRow,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"One mission of a conversation, as it reads in the activity panel. It is the `SidebarListRow` the left sidebar draws for a companion, fed mission data: the companion's blot as the leading media, the objective on the name line with the time at its end, the state as the row badge dot, and a preview line writing the platform mark, the ticket, the companion and, for the states a reader can act on, where the mission stands. Whether somebody is on it is read off the blot alone. Only the media differs from a roster row, kept at the mission avatar size, so the row is shorter. Reach for it inside `RoutinesPanel`; on its own it is only useful to check one row's states.",
			},
		},
	},
	args: {
		...WORKING_MISSION,
		onOpen: fn(),
	},
	render: (args) => (
		<Panel>
			<MissionRow {...args} />
		</Panel>
	),
})

export const Working = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A mission somebody is live on, which `apps/app/src/lib/missions/missions-model.ts` reads off the speakers of its thread and off how long its agent has been running, never off its state. Check that the blot holds the working pose the same mission carries on its thread card, that no badge dot is drawn on it, that the preview line opens on a word only a screen reader hears saying somebody is on it, that it runs the working shimmer a roster row runs for a busy companion, that it stops after the companion name since a mission being worked on stands nowhere a reader can act on, that the ticket identifier keeps the medium weight and the tabular figures of the row this one replaced while the companion stays at the line's own weight, that both read in the colour of the line, shimmer or not, and that the row reports the mission it belongs to when it is pressed. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(
			canvas.getByRole("img", { name: "Companion avatar owl, working" }),
		).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("1h")).toBeVisible()

		const line = previewIn(canvasElement)
		const identifier = canvas.getByText("OPE-42")
		await expect(line.firstElementChild).toHaveAttribute(
			"data-slot",
			"text-shimmer",
		)
		await expect(identifier).toBeVisible()
		await expect(figuresOf(identifier)).toBe("tabular-nums")
		await expect(weightOf(identifier)).toBe(MEDIUM_WEIGHT)
		await expect(
			partsIn(canvasElement).map((part) => part.textContent),
		).toEqual(["OPE-42", "Ada Martin"])
		await expect(canvas.getByText("Working now")).toBeInTheDocument()
		await expect(slotsIn(canvasElement, "mission-status")).toHaveLength(0)

		const name = canvas.getByText("Ada Martin")
		await expect(figuresOf(name)).toBe("normal")
		await expect(weightOf(name)).toBe(weightOf(line))
		await expect(colorOf(name)).toBe(colorOf(line))
		await expect(colorOf(identifier)).toBe(colorOf(line))

		const row = rowIn(canvasElement)
		await expect(row).toHaveAttribute("data-opens", WORKING_MISSION.id)
		await userEvent.click(canvas.getByText(WORKING_MISSION.objective))
		await expect(args.onOpen).toHaveBeenCalled()
	},
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The six states a mission can be in, exhaustively, each one drawn twice: with a companion live on it, then with nobody on it. Check that the row of each pair somebody is on opens on the word only a screen reader hears, that the preview line closes on a state word for the four states a reader can act on and stops at the companion name for `working` and `waiting_bot`, that the blot turns in the first row of each pair and rests in the second whatever the word beside it says, and that the badge dot keeps following the state rather than the work. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	render: (args) => (
		<Panel>
			{STATE_MATRIX.map((mission) => (
				<MissionRow {...args} {...mission} key={mission.id} />
			))}
		</Panel>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getAllByText("Working now")).toHaveLength(
			MISSION_STATES.length,
		)
		await expect(
			canvas.getAllByRole("img", { name: WORKING_POSE }),
		).toHaveLength(MISSION_STATES.length)
		await expect(
			canvas.getAllByRole("img", { name: RESTING_POSE }),
		).toHaveLength(MISSION_STATES.length)
		await expect(canvas.getAllByText("Blocked on you")).toHaveLength(
			ACTIVITIES.length,
		)
		await expect(canvas.getAllByText("Completed")).toHaveLength(
			ACTIVITIES.length,
		)
	},
})

export const WaitingForItsBot = meta.story({
	args: WAITING_BOT_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion has not picked it up yet, on a platform that names no identifier. Check that no badge dot is drawn, that the blot rests since nobody is on it, that the ticket title takes the place of the missing identifier right after the platform mark, that the line names no state, and that it stays on one line in the 320px panel, cut rather than wrapped. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const line = previewIn(canvasElement)

		await expect(dotIn(canvasElement)).toBeNull()
		await expect(
			canvas.getByRole("img", { name: "Companion avatar cat, idle" }),
		).toBeVisible()
		await expect(firstPartIn(canvasElement)).toHaveTextContent(
			WAITING_BOT_MISSION.ticket.title,
		)
		await expect(partsIn(canvasElement)).toHaveLength(2)
		await expect(getComputedStyle(line).whiteSpace).toBe("nowrap")
		await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth)
	},
})

export const PartsRepeatingTheSameWords = meta.story({
	args: {
		...WAITING_BOT_MISSION,
		ticket: {
			...WAITING_BOT_MISSION.ticket,
			title: WAITING_BOT_MISSION.bot.name,
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"A ticket titled after the companion running it, so the line writes the same words twice. Check that both parts are drawn, the second opened by its own separator, since a part is kept by the slot it fills rather than by the text it writes, and that no separator is left hanging where the state part used to close the line. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [ticket, ...opened] = partsIn(canvasElement)
		if (!ticket) throw new Error("The preview line writes no part")

		await expect(
			canvas.getAllByText(WAITING_BOT_MISSION.bot.name),
		).toHaveLength(2)
		await expect([ticket, ...opened].map((part) => part.textContent)).toEqual([
			WAITING_BOT_MISSION.bot.name,
			WAITING_BOT_MISSION.bot.name,
		])
		await expect(separatorOf(ticket)).toBe("none")
		for (const part of opened) await expect(separatorOf(part)).toBe('"·"')
	},
})

export const WaitingOnYou = meta.story({
	args: WAITING_HUMAN_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission stopped on a question only a person can answer. Check that the attention dot is drawn on the row, and that the wait is written once in text at the end of the preview line rather than repeated for a screen reader. " +
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
	},
})

export const ReadyToMerge = meta.story({
	args: READY_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose work is done and waiting to be merged. Check that the done dot replaces the attention one rather than adding to it, and that the state word is written once, at the end of the preview line. " +
					LISTED_BY_THE_PANEL,
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
					"A mission that failed and that nobody has closed. Check that it keeps an open mission's row rather than being moved out of sight, that the failed dot sets it apart, and that the state word says so in text as well. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(dotIn(canvasElement)).toHaveAttribute("data-badge", "failed")
		await expect(canvas.getByText("Blocked")).toBeVisible()
		await expect(canvas.getByText("3d")).toBeVisible()
	},
})

export const Closed = meta.story({
	args: CLOSED_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission closed earlier today. Check that the blot rests rather than holding the working pose, that the objective drops to the muted foreground the preview line already reads in, that no badge dot is drawn, that the time of day it closed takes the place of an age, and that the state word says it is done. `packages/ui/src/components/routines-panel.tsx:386` lists the missions that closed earlier today.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByRole("img", { name: "Companion avatar rabbit, idle" }),
		).toBeVisible()
		await expect(dotIn(canvasElement)).toBeNull()
		await expect(canvas.getByText("09:12")).toBeVisible()
		await expect(canvas.getByText("Completed")).toBeVisible()
		await expect(colorOf(slotIn(canvasElement, "roster-row-name"))).toBe(
			colorOf(previewIn(canvasElement)),
		)
	},
})

export const WithoutATicket = meta.story({
	args: UNTICKETED_MISSION,
	parameters: {
		docs: {
			description: {
				story:
					"A mission opened with no ticket at all, which the store keeps as empty strings rather than as nothing. Check that the preview line opens on the companion name, with no platform mark in front of it and no separator before it. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const first = firstPartIn(canvasElement)

		await expect(first).toHaveTextContent(UNTICKETED_MISSION.bot.name)
		await expect(previewIn(canvasElement).querySelector("svg")).toBeNull()
		await expect(separatorOf(first)).toBe("none")
	},
})

export const LongContent = meta.story({
	args: { ...WAITING_HUMAN_MISSION, objective: LONG_OBJECTIVE },
	parameters: {
		docs: {
			description: {
				story:
					"An objective no reader would write, in a panel at its 320px width. Check that the objective and the line under it each stay on one line and end in an ellipsis, that the row keeps its height, and that the blot is not squeezed to make room for them. " +
					LISTED_BY_THE_PANEL,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const objective = canvas.getByText(LONG_OBJECTIVE)
		const line = previewIn(canvasElement)

		await expect(objective.scrollWidth).toBeGreaterThan(objective.clientWidth)
		for (const clipped of [objective, line]) {
			await expect(getComputedStyle(clipped).whiteSpace).toBe("nowrap")
			await expect(getComputedStyle(clipped).textOverflow).toBe("ellipsis")
		}
		await expect(objective.clientHeight).toBe(20)
		await expect(line.clientHeight).toBe(16)
		await expect(boxOf(rowIn(canvasElement)).height).toBe(48)
		await expect(
			slotIn(canvasElement, "bot-identity-avatar").getBoundingClientRect()
				.width,
		).toBe(32)
	},
})

export const BoxMatchesARosterRow = meta.story({
	tags: ["test-only"],
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The mission row beside the roster row of the left sidebar, both drawn by `SidebarListRow`. Check that the two boxes share their padding, their leading gap, their corner and their borderless edge, and that only the height differs: 48px on the mission avatar against the 52px the roster draws on its 40px one. No panel holds both rows: `packages/ui/src/components/routines-panel.tsx:363` lists missions and the left sidebar lists companions, so the roster row here is the ruler the assertion measures against.",
			},
		},
	},
	render: (args) => (
		<Panel>
			<MissionRow {...args} />
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

export const WithStatus = meta.story({
	args: { ...WAITING_HUMAN_MISSION, status: MISSION_STATUS, now: MISSION_NOW },
	parameters: {
		docs: {
			description: {
				story:
					"A mission whose companion wrote a last status. Check that it closes the preview line after the dot the other parts are separated by, in the colour of the line, that the line draws no time for it and the timestamp slot keeps the time it had, that its tooltip hands the text and its relative time over, and that the row stays the one keyboard target opening the mission. Pick `Working` for a row with no status. Nothing on main feeds this prop yet.",
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
		await expect(colorOf(status)).toBe(colorOf(line))
		await expect(line.querySelector("time")).toBeNull()
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
		await expect(args.onOpen).toHaveBeenCalled()
	},
})

export const LongStatus = meta.story({
	args: {
		...WAITING_HUMAN_MISSION,
		status: LONG_MISSION_STATUS,
		now: MISSION_NOW,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A status written as several sentences, in a row of the width the activity panel gives it. Check that the preview line stays one line high and cuts on an ellipsis, that the timestamp slot stays whole, and that the tooltip raised from the status hands the whole text over. Pick `WithStatus` for a status that fits.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const line = previewIn(canvasElement)
		const status = slotIn(line, "mission-status")

		await expect(line.getBoundingClientRect().height).toBe(16)
		await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth)
		await expect(status).toHaveTextContent(LONG_MISSION_STATUS.text)
		await expect(
			canvas.getByText(WAITING_HUMAN_MISSION.timestamp),
		).toBeVisible()

		await userEvent.hover(status)
		await expect(await screen.findByRole("tooltip")).toHaveTextContent(
			LONG_MISSION_STATUS.text,
		)
	},
})
