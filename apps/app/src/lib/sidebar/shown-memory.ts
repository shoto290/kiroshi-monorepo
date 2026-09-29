import type {
	OpenedMission,
	SelectedRow,
} from "../missions/opened-mission-controller"

type ShownRoster = SelectedRow & { spaceId: string | null }

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
	let seenSpaceId: string | null = null
	let seenRowId: string | null = null

	const rememberRow = () => {
		const state = roster.getState()
		const rowId = rowOf(state)
		const hasMoved = state.spaceId !== seenSpaceId || rowId !== seenRowId
		seenSpaceId = state.spaceId
		seenRowId = rowId
		if (!hasMoved || openedMission.getState() || !state.spaceId || !rowId) {
			return
		}
		lastRows.set(state.spaceId, rowId)
	}

	const rememberMission = () => {
		const opened = openedMission.getState()
		const { spaceId } = roster.getState()
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
