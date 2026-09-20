import type { MissionState } from "@/lib/bindings"

export type {
	ConversationMissions,
	Mission,
	MissionClosing,
	MissionDetail,
	MissionDraft,
	MissionEntry,
	MissionError,
	MissionEvent,
	MissionEventKind,
	MissionNote,
	MissionOnBoard,
	MissionOutcome,
	MissionState,
	Ticket,
} from "@/lib/bindings"

export const PERSON_SOURCE = "person"

export type MissionChanged = {
	missionId: string
	state: MissionState
	stateSeq: number
	isAgentRunning: boolean
}
