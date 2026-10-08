import type {
	OpenedMission,
	SelectedRow,
} from "../missions/opened-mission-controller"

type ShownRoster = SelectedRow & { spaceRowId: string | null }

type Source<State> = {
	getState: () => State
	subscribe: (listener: () => void) => () => void
}

export type ShownMemorySources = {
	roster: Source<ShownRoster>
	openedMission: Source<OpenedMission | null>
}

export type ShownMemory = {
	lastRowIn: (spaceId: string) => string | null
	lastMissionIn: (spaceId: string) => string | null
}

const rowOf = ({ selectedBotId, selectedConversationId }: SelectedRow) =>
	selectedBotId ?? selectedConversationId

export const createShownMemory = ({
	roster,
	openedMission,
}: ShownMemorySources): ShownMemory => {
	const lastRows = new Map<string, string>()
	const lastMissions = new Map<string, string>()
	let seenSpaceRowId: string | null = null
	let seenRowId: string | null = null

	const rememberRow = () => {
		const state = roster.getState()
		const rowId = rowOf(state)
		const hasMoved = state.spaceRowId !== seenSpaceRowId || rowId !== seenRowId
		seenSpaceRowId = state.spaceRowId
		seenRowId = rowId
		if (!hasMoved || openedMission.getState() || !state.spaceRowId || !rowId) {
			return
		}
		lastRows.set(state.spaceRowId, rowId)
	}

	const rememberMission = () => {
		const opened = openedMission.getState()
		const spaceId = opened?.spaceId ?? roster.getState().spaceRowId
		if (opened && spaceId) {
			lastMissions.set(spaceId, opened.missionId)
		}
	}

	roster.subscribe(rememberRow)
	openedMission.subscribe(rememberMission)

	return {
		lastRowIn: (spaceId) => lastRows.get(spaceId) ?? null,
		lastMissionIn: (spaceId) => lastMissions.get(spaceId) ?? null,
	}
}
