import type {
	Application,
	ApplicationInstall,
	ApplicationInstalled,
	ApplicationPort,
	ApplicationsError,
	InstallRefusal,
} from "./application-port"

export type ApplicationCommand =
	| "catalogue"
	| "search"
	| "runnable"
	| "installs"

export type ApplicationCall = {
	command: ApplicationCommand
	query?: string
	conversationId?: string
	config?: Record<string, unknown>
}

export type FakeApplicationPort = ApplicationPort & {
	calls: ApplicationCall[]
	curated: Application[]
	found: Application[]
	foundFailure?: ApplicationsError
	recorded: ApplicationInstall[]
	runnerRefusal: InstallRefusal | null
	refusals: Partial<Record<ApplicationCommand, ApplicationsError>>
	announce: (installed: ApplicationInstalled) => void
	isListening: () => boolean
}

export const createFakeApplicationPort = (): FakeApplicationPort => {
	const listeners = new Set<(installed: ApplicationInstalled) => void>()

	const answer = (call: ApplicationCall) => {
		fake.calls.push(call)
		const refusal = fake.refusals[call.command]
		if (refusal !== undefined) {
			throw refusal
		}
	}

	const fake: FakeApplicationPort = {
		calls: [],
		curated: [],
		found: [],
		recorded: [],
		runnerRefusal: null,
		refusals: {},

		catalogue: async () => {
			answer({ command: "catalogue" })
			return fake.curated
		},

		search: async (query) => {
			answer({ command: "search", query })
			return { applications: fake.found, registryFailure: fake.foundFailure }
		},

		runnable: async (config) => {
			answer({ command: "runnable", config })
			return fake.runnerRefusal
		},

		installs: async (conversationId) => {
			answer({ command: "installs", conversationId })
			return fake.recorded.filter(
				(held) => held.conversationId === conversationId,
			)
		},

		onInstalled: async (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		announce: (installed) => {
			for (const listener of listeners) {
				listener(installed)
			}
		},

		isListening: () => listeners.size > 0,
	}

	return fake
}
