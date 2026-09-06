import { describe, expect, it } from "vitest"

import type { AppSidebarBot } from "@workspace/ui/components/app-sidebar"
import type { BotMissionState } from "@workspace/ui/components/badge"
import { BLANK_BOT_PERMISSIONS } from "@workspace/ui/components/bot-settings"

import type {
	Mission,
	MissionEvent,
	MissionOnBoard,
	MissionState,
} from "./mission-contract"
import {
	missionRingBadges,
	missionsByRow,
	toMissionEventModels,
	toMissionRows,
	withMissions,
} from "./missions-model"

import type { ThreadFace } from "@/lib/chat/thread-contract"
import type { Bot } from "@/lib/conversations/store-contract"

const missionIn = (state: MissionState): Mission => ({
	id: `m-${state}`,
	originConversationId: "c-1",
	botId: "b-1",
	threadConversationId: "c-mission-1",
	objective: "Rewrite the changelog parser",
	ticket: {
		platform: "linear",
		externalId: "OPE-42",
		url: "https://linear.app/ope-42",
		title: "Changelog parser",
	},
	tools: ["Read", "Write"],
	state,
	openedAt: 1_700_000_000_000,
	closedAt: null,
	reportedAt: null,
	reportedTurnId: null,
})

const READ_AT = Date.parse("2026-03-04T14:20:00")

const FACE: ThreadFace = {
	id: "b-1",
	name: "Ada Martin",
	animal: "owl",
}

const faceOf = (botId: string): ThreadFace | undefined =>
	botId === FACE.id ? FACE : undefined

const closedAt = (at: number): Mission => ({
	...missionIn("done"),
	closedAt: at,
})

describe("toMissionRows", () => {
	it("reads an open mission as the row of the activity panel", () => {
		const { open } = toMissionRows({
			open: [{ ...missionIn("working"), openedAt: READ_AT - 3_600_000 }],
			closed: [],
			faceOf,
			now: READ_AT,
		})

		expect(open).toEqual([
			{
				id: "m-working",
				objective: "Rewrite the changelog parser",
				ticket: {
					platform: "linear",
					externalId: "OPE-42",
					title: "Changelog parser",
				},
				bot: { name: "Ada Martin", animal: "owl", seed: "b-1" },
				state: "working",
				timestamp: "1h",
			},
		])
	})

	it("keeps only the missions closed since local midnight, at the time they closed", () => {
		const { earlierToday } = toMissionRows({
			open: [],
			closed: [
				closedAt(READ_AT - 7_200_000),
				closedAt(READ_AT - 3 * 86_400_000),
			],
			faceOf,
			now: READ_AT,
		})

		expect(earlierToday).toHaveLength(1)
		expect(earlierToday[0]?.timestamp).toBe("12:20")
	})

	it("leaves out a mission whose bot the conversation does not name", () => {
		const { open } = toMissionRows({
			open: [{ ...missionIn("working"), botId: "b-unknown" }],
			closed: [],
			faceOf,
			now: READ_AT,
		})

		expect(open).toEqual([])
	})
})

const EVENT: MissionEvent = {
	id: "e-1",
	missionId: "m-1",
	kind: "note",
	source: "claude-code",
	payload: null,
	createdAt: 1_700_000_000_000,
}

it("lets an event speak when its payload holds a text string", () => {
	const [model] = toMissionEventModels([
		{ ...EVENT, payload: { text: "The branch is pushed." } },
	])

	expect(model?.text).toBe("The branch is pushed.")
})

it("keeps an event silent when its payload holds no text", () => {
	const models = toMissionEventModels([
		EVENT,
		{ ...EVENT, id: "e-2", payload: {} },
		{ ...EVENT, id: "e-3", payload: { text: 42 } },
		{ ...EVENT, id: "e-4", payload: "The branch is pushed." },
	])

	expect(models.map(({ text }) => text)).toEqual([
		undefined,
		undefined,
		undefined,
		undefined,
	])
})

it("carries the kind, the source and the time of every event", () => {
	expect(toMissionEventModels([EVENT])).toEqual([
		{
			id: "e-1",
			kind: "note",
			source: "claude-code",
			createdAt: 1_700_000_000_000,
			text: undefined,
		},
	])
})

const mission = (over: Partial<Mission>): Mission => ({
	id: "m-1",
	originConversationId: "c-1",
	botId: "b-1",
	threadConversationId: "t-1",
	objective: "Drive every roster line from its mission.",
	ticket: {
		platform: "linear",
		externalId: "OPE-29",
		url: "https://linear.app/ope-29",
		title: "Roster line driven by mission state",
	},
	tools: [],
	state: "working",
	openedAt: 1,
	closedAt: null,
	reportedAt: null,
	reportedTurnId: null,
	...over,
})

const bot = (id: string): Bot => ({
	id,
	name: "Atlas",
	title: "",
	model: "sonnet",
	avatarAnimal: "owl",
	avatarBlot: "blue",
	avatarImagePath: null,
	workingDir: null,
	instructions: "",
	deniedTools: [],
	permissions: BLANK_BOT_PERMISSIONS,
	outputStyle: "",
	createdAt: 1,
	changesNothing: false,
	memory: "",
	sectionId: null,
	pinPosition: null,
})

const onBoard = (over: Partial<Mission>): MissionOnBoard => {
	const held = mission(over)
	return { mission: held, bot: bot(held.botId) }
}

const row = (over: Partial<AppSidebarBot>): AppSidebarBot => ({
	id: "b-1",
	name: "Atlas",
	title: "Research",
	lastMessage: "Pulled the three papers.",
	timestamp: "3m",
	...over,
})

const NO_LISTED_CONVERSATIONS: { id: string }[] = []

const OTHER_TICKET = { ...mission({}).ticket, externalId: "OPE-99" }

const TICKET = {
	platform: "linear",
	externalId: "OPE-29",
	title: "Roster line driven by mission state",
}

const shownMission = (id: string, state: BotMissionState, ticket = TICKET) => ({
	id,
	state,
	ticket,
})

const stripsFor = (...states: MissionState[]) =>
	missionsByRow(
		states.map((state, index) =>
			onBoard({ id: `m-${index + 1}`, openedAt: index + 1, state }),
		),
		NO_LISTED_CONVERSATIONS,
	)["b-1"]

describe("missionsByRow", () => {
	it("gives a row with one mission its id, its state and its ticket", () => {
		expect(stripsFor("working")).toEqual([shownMission("m-1", "working")])
	})

	it("lists every open mission of the row, most urgent first", () => {
		expect(stripsFor("working", "working", "ready_to_merge")).toEqual([
			shownMission("m-3", "ready"),
			shownMission("m-2", "working"),
			shownMission("m-1", "working"),
		])
	})

	it("opens the list on the most urgent state of the bot", () => {
		expect(stripsFor("working", "failed", "waiting_human")?.[0].state).toBe(
			"waiting",
		)
		expect(stripsFor("working", "ready_to_merge", "failed")?.[0].state).toBe(
			"failed",
		)
		expect(stripsFor("working", "ready_to_merge")?.[0].state).toBe("ready")
	})

	it("reads waiting for its bot as working", () => {
		expect(stripsFor("waiting_bot")).toEqual([shownMission("m-1", "working")])
	})

	it("opens on the mission opened most recently when two hold the most urgent state", () => {
		expect(
			missionsByRow(
				[
					onBoard({
						id: "m-late",
						openedAt: 5,
						state: "waiting_human",
						ticket: OTHER_TICKET,
					}),
					onBoard({ id: "m-early", openedAt: 2, state: "waiting_human" }),
					onBoard({ id: "m-running", openedAt: 1, state: "working" }),
				],
				NO_LISTED_CONVERSATIONS,
			)["b-1"],
		).toEqual([
			shownMission("m-late", "waiting", {
				platform: OTHER_TICKET.platform,
				externalId: OTHER_TICKET.externalId,
				title: OTHER_TICKET.title,
			}),
			shownMission("m-early", "waiting"),
			shownMission("m-running", "working"),
		])
	})

	it("leaves a closed mission out of the row whatever its state", () => {
		expect(
			missionsByRow(
				[
					onBoard({ id: "m-closed", state: "waiting_human", closedAt: 9 }),
					onBoard({ id: "m-open", state: "working" }),
				],
				NO_LISTED_CONVERSATIONS,
			)["b-1"],
		).toEqual([shownMission("m-open", "working")])
	})

	it("gives a row no list when every mission it holds is closed", () => {
		expect(
			missionsByRow(
				[onBoard({ id: "m-closed", state: "failed", closedAt: 9 })],
				NO_LISTED_CONVERSATIONS,
			),
		).toEqual({})
	})

	it("breaks a tie on the mission id so two reads of one board agree", () => {
		const board = [
			onBoard({
				id: "m-b",
				openedAt: 3,
				state: "failed",
				ticket: OTHER_TICKET,
			}),
			onBoard({ id: "m-a", openedAt: 3, state: "failed" }),
		]
		const ordered = ["m-a", "m-b"]

		expect(
			missionsByRow(board, NO_LISTED_CONVERSATIONS)["b-1"]?.map(({ id }) => id),
		).toEqual(ordered)
		expect(
			missionsByRow([...board].reverse(), NO_LISTED_CONVERSATIONS)["b-1"]?.map(
				({ id }) => id,
			),
		).toEqual(ordered)
	})

	it("passes the ticket platform, identifier and title through untouched", () => {
		expect(
			missionsByRow(
				[
					onBoard({
						ticket: {
							platform: "  GitHub  ",
							externalId: "#4172",
							url: "https://github.com/vocca/opennest/pull/4172",
							title: "  Resume the second turn  ",
						},
					}),
				],
				NO_LISTED_CONVERSATIONS,
			)["b-1"],
		).toEqual([
			{
				id: "m-1",
				state: "working",
				ticket: {
					platform: "  GitHub  ",
					externalId: "#4172",
					title: "  Resume the second turn  ",
				},
			},
		])
	})

	it("gives every bot its own chip", () => {
		expect(
			missionsByRow(
				[
					onBoard({ botId: "b-1", state: "failed" }),
					onBoard({ botId: "b-2", state: "working" }),
					onBoard({ botId: "b-2", state: "working" }),
				],
				NO_LISTED_CONVERSATIONS,
			),
		).toEqual({
			"b-1": [shownMission("m-1", "failed")],
			"b-2": [shownMission("m-1", "working"), shownMission("m-1", "working")],
		})
	})

	it("gives the chip to the conversation the mission was opened from", () => {
		expect(
			missionsByRow(
				[onBoard({ originConversationId: "c-1", state: "failed" })],
				[{ id: "c-1" }],
			),
		).toEqual({ "c-1": [shownMission("m-1", "failed")] })
	})

	it("gathers on one conversation row what its bots carry there", () => {
		expect(
			missionsByRow(
				[
					onBoard({
						originConversationId: "c-1",
						botId: "b-1",
						state: "working",
					}),
					onBoard({
						originConversationId: "c-1",
						botId: "b-2",
						state: "waiting_human",
					}),
				],
				[{ id: "c-1" }],
			),
		).toEqual({
			"c-1": [shownMission("m-1", "waiting"), shownMission("m-1", "working")],
		})
	})

	it("gives the chip to the bot when no listed conversation carries the mission", () => {
		expect(
			missionsByRow(
				[onBoard({ originConversationId: "c-solo", state: "working" })],
				[{ id: "c-1" }],
			),
		).toEqual({ "b-1": [shownMission("m-1", "working")] })
	})
})

describe("withMissions", () => {
	const held = row({ badge: "attention", status: "working", pose: "writing" })

	it("leaves the chat signals of the row untouched", () => {
		const carried = withMissions([held], {
			"b-1": [shownMission("m-1", "waiting")],
		})[0]

		expect(carried).toMatchObject({
			badge: "attention",
			title: "Research",
			lastMessage: "Pulled the three papers.",
			timestamp: "3m",
			status: "working",
			missions: [shownMission("m-1", "waiting")],
		})
	})

	it("leaves a row without a mission exactly as it reads", () => {
		expect(withMissions([held], {})).toEqual([held])
	})
})

describe("missionRingBadges", () => {
	const ringOf = (missions?: AppSidebarBot["missions"]) =>
		missionRingBadges({ work: [row({ missions })] }).work[0].badge

	it("lights the ring for a mission a person has to answer", () => {
		expect(ringOf([shownMission("m-1", "waiting")])).toBe("attention")
		expect(ringOf([shownMission("m-1", "failed")])).toBe("failed")
		expect(ringOf([shownMission("m-1", "ready")])).toBe("done")
	})

	it("leaves the ring dark for a mission that is still moving", () => {
		expect(ringOf([shownMission("m-1", "working")])).toBeUndefined()
		expect(ringOf(undefined)).toBeUndefined()
	})
})
