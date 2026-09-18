import {
	createHistoryController,
	type HistoryController,
	type HistoryState,
} from "./history-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type BotHistory = {
	state: HistoryState
	controller: HistoryController
}

export const useBotHistory = (store: TranscriptStore): BotHistory =>
	useController(() => createHistoryController(store))
