import type { Mission } from "./mission-contract"

import type { TranscriptRow } from "@/lib/chat/screen-model"

export type PlacedMission = {
	mission: Mission
	runIndex: number
}

export const BEFORE_FIRST_RUN = -1

const nearestRunOfBot = (
	runs: TranscriptRow[][],
	mission: Mission,
): number | null => {
	const spoken = runs.flatMap(([opening], index) =>
		opening.authorBotId === mission.botId ? [index] : [],
	)
	if (spoken.length === 0) {
		return null
	}
	const distanceOf = (index: number) =>
		Math.abs(runs[index][0].timestamp - mission.openedAt)

	return spoken.reduce(
		(nearest, index) =>
			distanceOf(index) <= distanceOf(nearest) ? index : nearest,
		spoken[0],
	)
}

const lastRunOpenedBy = (runs: TranscriptRow[][], moment: number): number =>
	runs.reduce(
		(last, run, index) => (run[0].timestamp <= moment ? index : last),
		BEFORE_FIRST_RUN,
	)

const openingRunIndex = (runs: TranscriptRow[][], mission: Mission): number =>
	nearestRunOfBot(runs, mission) ?? lastRunOpenedBy(runs, mission.openedAt)

export const placeMissions = (
	runs: TranscriptRow[][],
	missions: Mission[],
): PlacedMission[] =>
	[...missions]
		.sort((one, other) => one.openedAt - other.openedAt)
		.map((mission) => ({ mission, runIndex: openingRunIndex(runs, mission) }))
