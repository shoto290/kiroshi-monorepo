import {
	createHistoryFilesReader,
	type HistoryFilesState,
	initialHistoryFilesState,
} from "./history-files-controller"

import { createQueue } from "../queue"
import { createStore } from "../store"
import { botPlugin } from "../conversations/plugin-scope"
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
	const current = stateStore.getState

	const enqueue = createQueue()

	const set = (fields: Partial<HistoryState>) =>
		stateStore.setState({ ...current(), ...fields })

	const applyTo = (botId: string, fields: Partial<HistoryState>) => {
		if (current().botId === botId) {
			set(fields)
		}
	}

	const read = async (botId: string) =>
		applyTo(botId, {
			commits: await store.pluginHistory(botPlugin(botId)),
			hasFailedToLoad: false,
		})

	const noteFailedRead = () => set({ hasFailedToLoad: true })

	const reload = () => {
		const botId = current().botId
		if (botId) {
			void enqueue(() => read(botId)).catch(noteFailedRead)
		}
	}

	const onOpenBot = (run: (botId: string) => Promise<void>) => {
		const botId = current().botId
		if (botId) {
			void enqueue(() => run(botId)).catch(reload)
		}
	}

	const readFiles = createHistoryFilesReader(
		(oldestCommitId, newestCommitId) =>
			store.pluginHistoryDiff(
				botPlugin(current().botId ?? ""),
				oldestCommitId,
				newestCommitId,
			),
		{
			run: (task) => onOpenBot(task),
			getState: current,
			setState: set,
		},
	)

	return {
		getState: current,

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
			if (current().botId) {
				readFiles(oldestCommitId, newestCommitId)
			}
		},

		revert: (oldestCommitId: string, newestCommitId: string) =>
			onOpenBot(async (botId) =>
				applyTo(botId, {
					commits: await store.revertPlugin(
						botPlugin(botId),
						oldestCommitId,
						newestCommitId,
					),
				}),
			),
	}
}
