import { describe, expect, it } from "vitest"

import type { Mission } from "./mission-contract"
import { placeMissions } from "./mission-transcript"

import type { TranscriptRow } from "@/lib/chat/screen-model"

const rowOf = (
	authorBotId: string | null,
	timestamp: number,
): TranscriptRow => ({
	messageId: `m-${timestamp}`,
	turnId: `t-${timestamp}`,
	blockIndex: 0,
	quotedMessageId: null,
	authorBotId,
	role: authorBotId ? "assistant" : "user",
	text: "said",
	timestamp,
	completion: "complete",
})

const missionOf = (id: string, openedAt: number, botId = "bot-1"): Mission => ({
	id,
	originConversationId: "c-1",
	botId,
	threadConversationId: `c-${id}`,
	objective: "Rewrite the changelog parser",
	ticket: {
		platform: "linear",
		externalId: "OPE-42",
		url: "https://linear.app/ope-42",
		title: "Changelog parser",
	},
	tools: ["Read"],
	state: "working",
	stateSeq: 1,
	openedAt,
	closedAt: null,
	reportedAt: null,
	reportedTurnId: null,
})

const PROMPT = [rowOf(null, 0)]
const ANSWER = [rowOf("bot-1", 100)]
const LATER_PROMPT = [rowOf(null, 400)]
const LATER_ANSWER = [rowOf("bot-1", 500)]
const OTHER_BOT_ANSWER = [rowOf("bot-2", 250)]

describe("placeMissions", () => {
	const RUNS = [PROMPT, ANSWER, LATER_PROMPT, LATER_ANSWER]

	it("places a mission after the last run opened before it", () => {
		expect(placeMissions(RUNS, [missionOf("m-1", 200)])).toEqual([
			{ mission: missionOf("m-1", 200), runIndex: 1 },
		])
	})

	it("orders the missions placed on the same run by the time they were opened", () => {
		const placed = placeMissions(
			[PROMPT, ANSWER],
			[missionOf("m-late", 300), missionOf("m-early", 200)],
		)

		expect(placed.map(({ mission }) => mission.id)).toEqual([
			"m-early",
			"m-late",
		])
	})

	it("places a mission after the last run opened before it whatever bot wrote it", () => {
		expect(
			placeMissions(
				[PROMPT, ANSWER, OTHER_BOT_ANSWER, LATER_PROMPT],
				[missionOf("m-1", 300)],
			),
		).toEqual([{ mission: missionOf("m-1", 300), runIndex: 2 }])
	})

	it("places a mission on the run opened at its very moment", () => {
		expect(placeMissions(RUNS, [missionOf("m-1", 500)])).toEqual([
			{ mission: missionOf("m-1", 500), runIndex: 3 },
		])
	})

	it("keeps two missions of one bot apart when the runs in between are absent", () => {
		const placed = placeMissions(RUNS, [
			missionOf("m-early", 200),
			missionOf("m-late", 450),
		])

		expect(placed).toEqual([
			{ mission: missionOf("m-early", 200), runIndex: 1 },
			{ mission: missionOf("m-late", 450), runIndex: 2 },
		])
	})

	it("leaves a closed mission where it was opened when its bot ran again later", () => {
		const closed: Mission = {
			...missionOf("m-1", 200),
			state: "done",
			stateSeq: 4,
			closedAt: 480,
			reportedAt: 500,
			reportedTurnId: "t-500",
		}

		expect(placeMissions(RUNS, [closed])).toEqual([
			{ mission: closed, runIndex: 1 },
		])
	})

	it("leaves a mission older than every loaded run out of the feed", () => {
		expect(
			placeMissions([LATER_PROMPT, LATER_ANSWER], [missionOf("m-1", 200)]),
		).toEqual([])
	})

	it("draws a mission older than every loaded run once older runs are loaded", () => {
		expect(
			placeMissions(
				[PROMPT, ANSWER, LATER_PROMPT, LATER_ANSWER],
				[missionOf("m-1", 200)],
			),
		).toEqual([{ mission: missionOf("m-1", 200), runIndex: 1 }])
	})

	it("leaves a mission of a transcript with no run at all out of the feed", () => {
		expect(placeMissions([], [missionOf("m-1", 200)])).toEqual([])
	})
})
