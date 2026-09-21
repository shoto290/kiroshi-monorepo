import type { MissionState } from "@/lib/bindings"

export type {
	ConversationMissions,
	Mission,
	MissionClosing,
	MissionDetail,
	MissionEvent,
	MissionEventKind,
	MissionOnBoard,
	MissionOutcome,
	MissionState,
} from "@/lib/bindings"

export const PERSON_SOURCE = "person"

export type MissionChanged = {
	missionId: string
	state: MissionState
	stateSeq: number
	isAgentRunning: boolean
	lastActivityAt: number | null
}
