import type { MissionEventModel } from "@workspace/ui/components/mission"

import type { Mission } from "./mission-contract"
import {
	type SummonedMissionState,
	summonedStateOfText,
} from "./mission-summons"

import type { TranscriptRow } from "@/lib/chat/screen-model"

export type PlacedMission = {
	mission: Mission
	runIndex: number
}

export type PlacedMissionEvent = {
	event: MissionEventModel
	runIndex: number
}

export const BEFORE_FIRST_RUN = -1

const lastRunOpenedBefore = (runs: TranscriptRow[][], moment: number): number =>
	runs.reduce(
		(last, run, index) => (run[0].timestamp <= moment ? index : last),
		BEFORE_FIRST_RUN,
	)

const isDrawnInFeed = (runs: TranscriptRow[][], runIndex: number): boolean =>
	runs.length === 0 || runIndex !== BEFORE_FIRST_RUN

export const placeMissions = (
	runs: TranscriptRow[][],
	missions: Mission[],
): PlacedMission[] =>
	[...missions]
		.sort((one, other) => one.openedAt - other.openedAt)
		.map((mission) => ({
			mission,
			runIndex: lastRunOpenedBefore(runs, mission.openedAt),
		}))
		.filter(({ runIndex }) => isDrawnInFeed(runs, runIndex))

export const placeMissionEvents = (
	runs: TranscriptRow[][],
	events: MissionEventModel[],
): PlacedMissionEvent[] =>
	[...events]
		.sort((one, other) => one.createdAt - other.createdAt)
		.map((event) => ({
			event,
			runIndex: lastRunOpenedBefore(runs, event.createdAt),
		}))

export type MissionSummonsCause = {
	turnId: string
	state: SummonedMissionState
}

export type MissionTranscript = {
	rows: TranscriptRow[]
	summonsCauses: MissionSummonsCause[]
}

const summonedStateOf = (
	row: TranscriptRow,
): SummonedMissionState | undefined =>
	row.role === "user" && row.authorBotId === null
		? summonedStateOfText(row.text)
		: undefined

export const withoutMissionSummons = (
	rows: TranscriptRow[],
	botId: string,
): MissionTranscript => {
	const kept: TranscriptRow[] = []
	const summonsCauses: MissionSummonsCause[] = []
	let summoned: SummonedMissionState | undefined

	for (const row of rows) {
		const state = summonedStateOf(row)
		if (state) {
			summoned = state
			continue
		}
		if (summoned && row.authorBotId === botId) {
			summonsCauses.push({ turnId: row.turnId, state: summoned })
		}
		summoned = undefined
		kept.push(row)
	}

	return { rows: kept, summonsCauses }
}
