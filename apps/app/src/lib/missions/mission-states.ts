import type { MissionChanged, MissionState } from "./mission-contract"

type MissionStanding = Pick<MissionChanged, "missionId" | "state">

export type MissionStates = {
	entered: (changed: MissionStanding) => boolean
	remember: (changed: MissionStanding) => void
}

export const createMissionStates = (): MissionStates => {
	const seen = new Map<string, MissionState>()

	return {
		entered: ({ missionId, state }) => seen.get(missionId) !== state,

		remember: ({ missionId, state }) => {
			seen.set(missionId, state)
		},
	}
}
