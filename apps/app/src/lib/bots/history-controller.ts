import {
	createHistoryFilesReader,
	type HistoryFilesState,
	initialHistoryFilesState,
} from "./history-files-controller"

import { createQueue } from "../queue"
import { createStore } from "../store"
import type { BotHistoryEntry } from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type HistoryState = HistoryFilesState & {
	botId: string | null
	commits: BotHistoryEntry[]
	hasFailedToLoad: boolean
}

export type HistoryController = {
	getState: () => HistoryState
	subscribe: (listener: () => void) => () => void
	open: (botId: string) => Promise<void>
	reload: () => void
	openFiles: (oldestCommitId: string, newestCommitId: string) => void
	revert: (oldestCommitId: string, newestCommitId: string) => void
}

const INITIAL_STATE: HistoryState = {
	...initialHistoryFilesState,
	botId: null,
	commits: [],
	hasFailedToLoad: false,
}

export const createHistoryController = (
	store: TranscriptStore,
): HistoryController => {
	const stateStore = createStore(INITIAL_STATE)

	const enqueue = createQueue()

	const set = (fields: Partial<HistoryState>) =>
		stateStore.setState({ ...stateStore.getState(), ...fields })

	const applyTo = (botId: string, fields: Partial<HistoryState>) => {
		if (stateStore.getState().botId === botId) {
			set(fields)
		}
	}

	const read = async (botId: string) =>
		applyTo(botId, {
			commits: await store.botHistory(botId),
			hasFailedToLoad: false,
		})

	const noteFailedRead = () => set({ hasFailedToLoad: true })

	const reload = () => {
		const botId = stateStore.getState().botId
		if (botId) {
			void enqueue(() => read(botId)).catch(noteFailedRead)
		}
	}

	const onOpenBot = (run: (botId: string) => Promise<void>) => {
		const botId = stateStore.getState().botId
		if (botId) {
			void enqueue(() => run(botId)).catch(reload)
		}
	}

	const readFiles = createHistoryFilesReader(
		(oldestCommitId, newestCommitId) =>
			store.botHistoryDiff(
				stateStore.getState().botId ?? "",
				oldestCommitId,
				newestCommitId,
			),
		{
			run: (task) => onOpenBot(task),
			getState: stateStore.getState,
			setState: set,
		},
	)

	return {
		getState: stateStore.getState,

		subscribe: stateStore.subscribe,

		open: (botId: string) => {
			set({
				...initialHistoryFilesState,
				botId,
				commits: [],
				hasFailedToLoad: false,
			})
			return enqueue(() => read(botId)).catch(noteFailedRead)
		},

		reload,

		openFiles: (oldestCommitId: string, newestCommitId: string) => {
			if (stateStore.getState().botId) {
				readFiles(oldestCommitId, newestCommitId)
			}
		},

		revert: (oldestCommitId: string, newestCommitId: string) =>
			onOpenBot(async (botId) =>
				applyTo(botId, {
					commits: await store.revertBot(botId, oldestCommitId, newestCommitId),
				}),
			),
	}
}
