import {
	createRosterController,
	type RosterController,
	type RosterState,
} from "./roster-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type Roster = {
	state: RosterState
	controller: RosterController
}

export const useRoster = (store: TranscriptStore): Roster =>
	useController(() => createRosterController(store))
