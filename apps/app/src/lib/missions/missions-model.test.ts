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

describe("toMissionRows", () => {
	it("reads a mission as the ticket, the tools and the time its row shows", () => {
		expect(toMissionRows([missionIn("working")])).toEqual([
			{
				id: "m-working",
				objective: "Rewrite the changelog parser",
				ticketId: "OPE-42",
				tools: ["Read", "Write"],
				openedAt: 1_700_000_000_000,
				badge: null,
			},
		])
	})

	it("badges only the missions a reader has something to do about", () => {
		const badges = (
			[
				"working",
				"waiting_bot",
				"waiting_human",
				"ready_to_merge",
				"failed",
				"done",
			] as const
		).map((state) => toMissionRows([missionIn(state)])[0]?.badge)

		expect(badges).toEqual([null, null, "attention", "done", "failed", null])
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

const shownMission = (state: BotMissionState, otherCount: number) => ({
	state,
	ticket: TICKET,
	otherCount,
})

const chipFor = (...states: MissionState[]) =>
	missionsByRow(
		states.map((state, index) =>
			onBoard({ id: `m-${index + 1}`, openedAt: index + 1, state }),
		),
		NO_LISTED_CONVERSATIONS,
	)["b-1"]

describe("missionsByRow", () => {
	it("gives a row with one mission its state and its ticket, and nothing else", () => {
		expect(chipFor("working")).toEqual(shownMission("working", 0))
	})

	it("counts as others every open mission of the row but the one shown", () => {
		expect(chipFor("working", "working", "ready_to_merge")).toEqual(
			shownMission("ready", 2),
		)
	})

	it("shows the most urgent state of the bot", () => {
		expect(chipFor("working", "failed", "waiting_human").state).toBe("waiting")
		expect(chipFor("working", "ready_to_merge", "failed").state).toBe("failed")
		expect(chipFor("working", "ready_to_merge").state).toBe("ready")
	})

	it("reads waiting for its bot as working", () => {
		expect(chipFor("waiting_bot")).toEqual(shownMission("working", 0))
	})

	it("shows the mission opened first when two hold the most urgent state", () => {
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
		).toEqual(shownMission("waiting", 2))
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

		expect(missionsByRow(board, NO_LISTED_CONVERSATIONS)["b-1"]).toEqual(
			shownMission("failed", 1),
		)
		expect(
			missionsByRow([...board].reverse(), NO_LISTED_CONVERSATIONS)["b-1"],
		).toEqual(shownMission("failed", 1))
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
		).toEqual({
			state: "working",
			ticket: {
				platform: "  GitHub  ",
				externalId: "#4172",
				title: "  Resume the second turn  ",
			},
			otherCount: 0,
		})
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
			"b-1": shownMission("failed", 0),
			"b-2": shownMission("working", 1),
		})
	})

	it("gives the chip to the conversation the mission was opened from", () => {
		expect(
			missionsByRow(
				[onBoard({ originConversationId: "c-1", state: "failed" })],
				[{ id: "c-1" }],
			),
		).toEqual({ "c-1": shownMission("failed", 0) })
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
		).toEqual({ "c-1": shownMission("waiting", 1) })
	})

	it("gives the chip to the bot when no listed conversation carries the mission", () => {
		expect(
			missionsByRow(
				[onBoard({ originConversationId: "c-solo", state: "working" })],
				[{ id: "c-1" }],
			),
		).toEqual({ "b-1": shownMission("working", 0) })
	})
})

describe("withMissions", () => {
	const held = row({ badge: "attention", status: "working", pose: "writing" })

	it("leaves the chat signals of the row untouched", () => {
		const carried = withMissions([held], {
			"b-1": shownMission("waiting", 1),
		})[0]

		expect(carried).toMatchObject({
			badge: "attention",
			title: "Research",
			lastMessage: "Pulled the three papers.",
			timestamp: "3m",
			status: "working",
			mission: shownMission("waiting", 1),
		})
	})

	it("leaves a row without a mission exactly as it reads", () => {
		expect(withMissions([held], {})).toEqual([held])
	})
})

const MISSION_STATES: MissionState[] = [
	"working",
	"waiting_bot",
	"waiting_human",
	"ready_to_merge",
	"failed",
	"done",
]

describe("mission badges", () => {
	it("says the same thing on a roster ring as on a panel row", () => {
		for (const state of MISSION_STATES) {
			const chip = missionsByRow([onBoard({ state })], NO_LISTED_CONVERSATIONS)[
				"b-1"
			]
			const ring = chip
				? missionRingBadges({ work: [row({ mission: chip })] }).work[0].badge
				: undefined

			expect(ring ?? null).toBe(toMissionRows([mission({ state })])[0].badge)
		}
	})
})

describe("missionRingBadges", () => {
	const ringOf = (mission?: AppSidebarBot["mission"]) =>
		missionRingBadges({ work: [row({ mission })] }).work[0].badge

	it("lights the ring for a mission a person has to answer", () => {
		expect(ringOf(shownMission("waiting", 0))).toBe("attention")
		expect(ringOf(shownMission("failed", 0))).toBe("failed")
		expect(ringOf(shownMission("ready", 0))).toBe("done")
	})

	it("leaves the ring dark for a mission that is still moving", () => {
		expect(ringOf(shownMission("working", 0))).toBeUndefined()
		expect(ringOf(undefined)).toBeUndefined()
	})
})
