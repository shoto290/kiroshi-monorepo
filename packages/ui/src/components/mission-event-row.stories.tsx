import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { listExhaustively, slotsIn } from "@workspace/storybook/story-utils"
import type { MissionEventKind } from "@workspace/ui/components/mission"
import { MissionEventRow } from "@workspace/ui/components/mission-event-row"
import {
	AUTHORED_MISSION_EVENTS,
	MISSION_EVENTS,
	MISSION_NOW,
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
					"One thing a mission recorded, dropped in the transcript at the moment it landed. An event whose payload holds a text string speaks, and reads as an authored event: the source that wrote it, the kind it is, the time it landed, and the soft bubble the transcript already uses. Every other event is a machine line, kept to one line so the transcript stays scannable however much a bot writes into a payload.",
			},
		},
	},
	args: { event: MACHINE_EVENT, now: MISSION_NOW },
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
					"The mission being opened, with nothing written into its payload. Check that it reads as one muted line: the source, the wording of the kind, and the time on the right edge. Pick `AuthoredEvent` for the form an event carrying text takes.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-machine-line")).toHaveLength(1)
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
					"A note the agent wrote against the mission. Check that the source names who wrote it, that the badge names which kind it is, that the time sits on the same right edge the machine line uses, and that the text lands in the soft bubble the transcript already uses. Pick `MachineLine` for the silent form.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [authored] = slotsIn(canvasElement, "mission-authored-event")

		await expect(authored).toHaveTextContent(AUTHORED_EVENT.source)
		await expect(slotsIn(canvasElement, "mission-machine-line")).toHaveLength(0)
	},
})

export const EventKinds = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The eight kinds an event can carry, exhaustively, all in their machine form. Check that each kind reads as a distinct sentence and that none of them falls back to a raw identifier. Adding a kind to `MISSION_EVENT_KINDS` without adding its wording to the catalogue surfaces here as a missing sentence.",
			},
		},
	},
	render: (args) => (
		<div className="flex w-[36rem] max-w-full flex-col gap-2">
			{MISSION_EVENT_KINDS.map((kind, rank) => (
				<MissionEventRow
					{...args}
					event={{
						id: `event-${kind}`,
						kind,
						source: "claude-code",
						createdAt:
							MISSION_NOW - (MISSION_EVENT_KINDS.length - rank) * 60_000,
					}}
					key={kind}
				/>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-machine-line")).toHaveLength(
			MISSION_EVENT_KINDS.length,
		)
	},
})

export const AuthoredEvents = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A note, a question to the agent, an answer and an escalation, one after the other. Check that each bubble is readable as its own event rather than as more of the last one. The answer comes from a person and the other three from the agent, and the only thing that says so is the name, so read the four names before the four fills.",
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
