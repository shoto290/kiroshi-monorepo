import type { MissionState } from "./mission-contract"

export type SummonedMissionState = Extract<
	MissionState,
	"working" | "waiting_bot"
>

const SUMMONS_OF = {
	working: "Carry out this mission.",
	waiting_bot:
		"The coding agent of this mission is blocked and waiting on you.",
} as const satisfies Record<SummonedMissionState, string>

export const isSummonedMissionState = (
	state: MissionState,
): state is SummonedMissionState => state in SUMMONS_OF

export const missionSummonsFor = (state: SummonedMissionState): string =>
	SUMMONS_OF[state]
