import { createStore } from "../store"
import type { EnvEntry, EnvScope } from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type EnvironmentState = {
	scope: EnvScope | null
	entries: EnvEntry[]
	hasFailedToRead: boolean
}

export type EnvironmentController = {
	getState: () => EnvironmentState
	subscribe: (listener: () => void) => () => void
	open: (scope: EnvScope) => Promise<void>
	set: (name: string, value: string) => Promise<void>
	remove: (name: string) => Promise<void>
}

const initialEnvironmentState: EnvironmentState = {
	scope: null,
	entries: [],
	hasFailedToRead: false,
}

export const createEnvironmentController = (
	store: TranscriptStore,
): EnvironmentController => {
	const stateStore = createStore(initialEnvironmentState)
	const current = stateStore.getState

	const set = (fields: Partial<EnvironmentState>) =>
		stateStore.setState({ ...current(), ...fields })

	const read = (scope: EnvScope) =>
		store
			.environmentVariables(scope)
			.then((entries) => {
				if (current().scope === scope) {
					set({ entries, hasFailedToRead: false })
				}
			})
			.catch(() => {
				if (current().scope === scope) {
					set({ hasFailedToRead: true })
				}
			})

	const write = async (run: (scope: EnvScope) => Promise<void>) => {
		const scope = current().scope
		if (!scope) {
			return
		}
		await run(scope)
		await read(scope)
	}

	return {
		getState: stateStore.getState,

		subscribe: stateStore.subscribe,

		open: (scope: EnvScope) => {
			set({ scope, entries: [], hasFailedToRead: false })
			return read(scope)
		},

		set: (name: string, value: string) =>
			write((scope) => store.setEnvironmentVariable(scope, name, value)),

		remove: (name: string) =>
			write((scope) => store.deleteEnvironmentVariable(scope, name)),
	}
}
