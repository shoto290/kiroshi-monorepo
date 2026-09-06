import type { MissionChanged } from "./mission-contract"

type MissionStanding = Pick<MissionChanged, "missionId" | "stateSeq">

export type MissionSeqs = {
	handled: (standing: MissionStanding) => boolean
	remember: (standing: MissionStanding) => void
}

export const createMissionSeqs = (): MissionSeqs => {
	const lastHandled = new Map<string, number>()

	return {
		handled: ({ missionId, stateSeq }) => {
			const last = lastHandled.get(missionId)
			return last !== undefined && stateSeq <= last
		},

		remember: ({ missionId, stateSeq }) => {
			lastHandled.set(missionId, stateSeq)
		},
	}
}
