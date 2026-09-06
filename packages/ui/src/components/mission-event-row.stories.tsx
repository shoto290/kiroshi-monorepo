import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { listExhaustively, slotsIn } from "@workspace/storybook/story-utils"
import type { MissionEventKind } from "@workspace/ui/components/mission"
import { MissionEventRow } from "@workspace/ui/components/mission-event-row"
import { MissionHeader } from "@workspace/ui/components/mission-header"
import {
	AUTHORED_MISSION_EVENTS,
	MISSION_BOT,
	MISSION_EVENTS,
	MISSION_NOW,
	MISSION_OBJECTIVE,
	MISSION_OPENED_AT,
	MISSION_TICKET,
	MISSION_TOOLS,
} from "@workspace/ui/components/missions.fixtures"

const MISSION_EVENT_KINDS = listExhaustively<MissionEventKind>({
	opened: true,
	note: true,
	agent_asked: true,
	answered: true,
	escalated: true,
	ready: true,
	failed: true,
	closed: true,
})

const UNBREAKABLE_SOURCE =
	"claude-code-runtime-session-0f3a9c1d4e5b6a7c8d9e0f1a2b3c4d5e"

const [MACHINE_EVENT, AUTHORED_EVENT] = MISSION_EVENTS

const meta = preview.meta({
	title: "Conversation/Missions/MissionEventRow",
	component: MissionEventRow,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"One thing a mission recorded, dropped in the transcript at the moment it landed. An event whose payload holds a text string speaks, and takes the gutter and the content column of an assistant message: the source that wrote it, the kind it is, the time it landed, and the soft bubble the transcript already uses. Every other event is a machine line, kept to one line so the transcript stays scannable however much a bot writes into a payload.",
			},
		},
	},
	args: { event: MACHINE_EVENT, bot: MISSION_BOT, now: MISSION_NOW },
	render: (args) => (
		<div className="w-[36rem] max-w-full">
			<MissionEventRow {...args} />
		</div>
	),
})

export const MachineLine = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The mission being opened, with nothing written into its payload. Check that it reads as one muted line: a dot, a sentence folding the source into what happened, and the time on the trailing edge. Pick `AuthoredEvent` for the form an event carrying text takes.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [line] = slotsIn(canvasElement, "mission-machine-line")

		await expect(line).toHaveTextContent(MACHINE_EVENT.source)
		await expect(slotsIn(canvasElement, "mission-authored-event")).toHaveLength(
			0,
		)
	},
})

export const AuthoredEvent = meta.story({
	args: { event: AUTHORED_EVENT },
	parameters: {
		docs: {
			description: {
				story:
					"A note the agent wrote against the mission. Check that the gutter carries the mission bot, that the author line names the source, its kind and its time, and that the text lands in the soft bubble the transcript already uses. Pick `MachineLine` for the silent form and `WithAToolGutter` for a source a tool glyph names.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [authored] = slotsIn(canvasElement, "mission-authored-event")
		const [gutter] = slotsIn(canvasElement, "mission-event-gutter")

		await expect(authored).toHaveTextContent(AUTHORED_EVENT.source)
		await expect(gutter).toHaveAttribute("data-gutter", "bot")
	},
})

export const WithAToolGutter = meta.story({
	args: {
		event: {
			id: "event-tool-note",
			kind: "note",
			source: "github",
			createdAt: MISSION_NOW - 600_000,
			text: "Opened the pull request against the branch the mission was handed.",
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"An event whose source is a tool the system draws a glyph for. Check that the gutter is a round muted surface carrying that glyph rather than the mission bot avatar. Pick `AuthoredEvent` for a source no tool names, which falls back to the bot.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [gutter] = slotsIn(canvasElement, "mission-event-gutter")

		await expect(gutter).toHaveAttribute("data-gutter", "tool")
		await expect(slotsIn(canvasElement, "mission-tool-mark")).toHaveLength(1)
	},
})

export const EventKinds = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The eight kinds an event can carry, exhaustively, each once as a machine line and once as a bubble. Check that every machine line folds its source into its sentence, that every bubble carries the kind as a badge, and that only the agent asked badge is tinted. Adding a kind without adding its wording to the catalogue surfaces here as a missing sentence.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-[36rem] max-w-full flex-col gap-3">
			{MISSION_EVENT_KINDS.map((kind, rank) => (
				<div className="flex flex-col gap-2" key={kind}>
					<MissionEventRow
						{...args}
						event={{
							id: `event-${kind}`,
							kind,
							source: "claude-code",
							createdAt:
								MISSION_NOW - (MISSION_EVENT_KINDS.length - rank) * 60_000,
						}}
					/>
					<MissionEventRow
						{...args}
						event={{
							id: `event-${kind}-text`,
							kind,
							source: "claude-code",
							createdAt:
								MISSION_NOW - (MISSION_EVENT_KINDS.length - rank) * 30_000,
							text: `What the mission recorded when it was ${kind.replace("_", " ")}.`,
						}}
					/>
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-machine-line")).toHaveLength(
			MISSION_EVENT_KINDS.length,
		)
		await expect(slotsIn(canvasElement, "mission-authored-event")).toHaveLength(
			MISSION_EVENT_KINDS.length,
		)
	},
})

export const AuthoredEvents = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A note, a question to the agent, an answer and an escalation, one after the other. Check that each bubble is readable as its own event rather than as more of the last one, and that the question stands out by its tinted badge alone rather than by a louder bubble.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-[36rem] max-w-full flex-col gap-2">
			{AUTHORED_MISSION_EVENTS.map((event) => (
				<MissionEventRow {...args} event={event} key={event.id} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const authored = slotsIn(canvasElement, "mission-authored-event")

		await expect(authored).toHaveLength(AUTHORED_MISSION_EVENTS.length)

		for (const [rank, event] of AUTHORED_MISSION_EVENTS.entries()) {
			await expect(authored[rank]).toHaveTextContent(event.source)
		}
	},
})

export const InAMissionThread = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The header and the rows a mission thread is made of, in a container squeezed to 480 pixels. Check that no row is wider than the container, that the bubbles stop at three quarters of it, and that the header bands hold their two lines. Pick this one before shipping any change to either component.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-[30rem] max-w-full flex-col gap-2">
			<MissionHeader
				bot={MISSION_BOT}
				now={MISSION_NOW}
				objective={MISSION_OBJECTIVE}
				onBack={fn()}
				openedAt={MISSION_OPENED_AT}
				state="waiting_human"
				ticket={MISSION_TICKET}
				tools={MISSION_TOOLS}
			/>
			{MISSION_EVENTS.map((event) => (
				<MissionEventRow {...args} event={event} key={event.id} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const row of slotsIn(canvasElement, "mission-event-row")) {
			await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1)
		}
	},
})

export const LongContent = meta.story({
	args: {
		event: {
			id: "event-long-source",
			kind: "note",
			source: UNBREAKABLE_SOURCE,
			createdAt: MISSION_NOW - 60_000,
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"A source no human authored, in a container squeezed to 320 pixels. Check that the machine line stays on exactly one line and truncates rather than pushing the time out of view. Pick `MachineLine` for realistic lengths.",
			},
		},
	},
	render: (args) => (
		<div className="w-80 max-w-full">
			<MissionEventRow {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const line = slotsIn(canvasElement, "mission-machine-line")[0]

		await expect(line).toBeVisible()
		await expect(line?.scrollWidth).toBeLessThanOrEqual(
			(line?.clientWidth ?? 0) + 1,
		)
	},
})
