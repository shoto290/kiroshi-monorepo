import { readMcpServerLaunch } from "@workspace/ui/components/bot-settings-dialog/mcp-server-launch"
import {
	type NoticeMessage,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type {
	Application,
	ApplicationPort,
	InstallField,
} from "./application-port"

import {
	declaredServers,
	declareServer,
	undeclareServer,
} from "../bots/mcp-server-writes"
import type { EnvOwner, EnvScope } from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type ApplicationsState = {
	curated: Application[]
	isReadingCatalogue: boolean
	hasCatalogueFailed: boolean
	query: string
	registry: Application[]
	isSearching: boolean
	hasSearchFailed: boolean
	hasSearchPartlyFailed: boolean
	picked: Application | null
	installing: string | null
	failure: string | null
}

export type InstallTarget = {
	owner: EnvOwner
	declared: string[]
	connect: (name: string, url: string) => Promise<void>
	settle: () => Promise<void>
}

export type ApplicationsController = {
	getState: () => ApplicationsState
	subscribe: (listener: () => void) => () => void
	open: () => Promise<void>
	browse: () => void
	search: (query: string) => void
	retry: () => void
	pick: (id: string) => void
	leave: () => void
	install: (target: InstallTarget, values?: InstallValues) => Promise<void>
}

export const initialApplicationsState: ApplicationsState = {
	curated: [],
	isReadingCatalogue: false,
	hasCatalogueFailed: false,
	query: "",
	registry: [],
	isSearching: false,
	hasSearchFailed: false,
	hasSearchPartlyFailed: false,
	picked: null,
	installing: null,
	failure: null,
}

const isRecord = (reason: unknown): reason is Record<string, unknown> =>
	typeof reason === "object" && reason !== null

const refusalTextOf = (reason: unknown): string => {
	if (reason instanceof Error) {
		return reason.message
	}
	if (typeof reason === "string") {
		return reason
	}
	if (isRecord(reason) && typeof reason.kind === "string") {
		return typeof reason.detail === "string"
			? `${reason.kind}: ${reason.detail}`
			: reason.kind
	}
	return String(reason)
}

export const serverScopeOf = (owner: EnvOwner, name: string): EnvScope => ({
	kind: "server",
	name,
	owner,
})

export type InstallValues = Record<string, string>

type TypedValue = { field: InstallField; value: string }

const typedValuesOf = (
	install: Application["install"],
	values: InstallValues,
): TypedValue[] =>
	install.kind === "key"
		? install.fields.map((field) => ({
				field,
				value: values[field.name] ?? "",
			}))
		: []

const urlOf = (application: Application) =>
	readMcpServerLaunch(application.config).url ?? ""

export const REGISTRY_SEARCH_DELAY_MS = 400

export type ApplicationsControllerOptions = {
	reportFailure?: (notice: NoticeMessage) => void
	searchDelayMs?: number
}

export const createApplicationsController = (
	port: ApplicationPort,
	store: TranscriptStore,
	{
		reportFailure = raiseFailureNotice,
		searchDelayMs = REGISTRY_SEARCH_DELAY_MS,
	}: ApplicationsControllerOptions = {},
): ApplicationsController => {
	let state = initialApplicationsState
	let scheduledSearch: ReturnType<typeof setTimeout> | null = null
	let issuedSearch = 0
	let openingApplications: Application[] | null = null
	const listeners = new Set<() => void>()

	const publish = () => {
		for (const listener of listeners) {
			listener()
		}
	}

	const set = (fields: Partial<ApplicationsState>) => {
		state = { ...state, ...fields }
		publish()
	}

	const supersedeSearch = () => {
		if (scheduledSearch !== null) {
			clearTimeout(scheduledSearch)
			scheduledSearch = null
		}
		issuedSearch += 1
	}

	const issueSearch = () => {
		supersedeSearch()
		set({
			isSearching: true,
			hasSearchFailed: false,
			hasSearchPartlyFailed: false,
		})
		return issuedSearch
	}

	const sendSearch = () => {
		const typed = state.query.trim()
		const isOpening = typed === ""
		const attempt = issueSearch()
		const isLastIssued = () => attempt === issuedSearch
		void port.search(typed).then(
			(found) => {
				if (!isLastIssued()) {
					return
				}
				const hasRegistryFailed = found.registryFailure !== undefined
				if (isOpening) {
					openingApplications = hasRegistryFailed ? null : found.applications
				}
				set({
					registry: found.applications,
					isSearching: false,
					hasSearchPartlyFailed: hasRegistryFailed,
				})
			},
			() => {
				if (!isLastIssued()) {
					return
				}
				if (isOpening) {
					openingApplications = null
				}
				set({ isSearching: false, hasSearchFailed: true })
			},
		)
	}

	const scheduleSearch = () => {
		issueSearch()
		scheduledSearch = setTimeout(sendSearch, searchDelayMs)
	}

	const showOpening = (held: Application[]) => {
		supersedeSearch()
		set({
			registry: held,
			isSearching: false,
			hasSearchFailed: false,
			hasSearchPartlyFailed: false,
		})
	}

	const applicationNamed = (id: string) =>
		[...state.curated, ...state.registry].find((held) => held.name === id) ??
		null

	const rollBackDeclaration = async (owner: EnvOwner, name: string) => {
		try {
			await undeclareServer(store, owner, name)
		} catch (refusal) {
			reportFailure({
				title: i18n.t("bots:applications.install.rollback.title", { name }),
				description: i18n.t("bots:applications.install.rollback.description", {
					reason: refusalTextOf(refusal),
				}),
			})
		}
	}

	const writeKeys = async (
		owner: EnvOwner,
		name: string,
		asked: TypedValue[],
	) => {
		const scope = serverScopeOf(owner, name)
		for (const { field, value } of asked) {
			await store.setEnvironmentVariable(scope, field.secret, value)
		}
	}

	const isDeclaredUnder = async (owner: EnvOwner, name: string) => {
		const held = await declaredServers(store, owner)
		return held.some((server) => server.name === name)
	}

	const runInstall = async (
		application: Application,
		target: InstallTarget,
		values: InstallValues,
	) => {
		if (application.install.kind === "refused") {
			throw new Error(application.install.reason)
		}
		const asked = typedValuesOf(application.install, values)
		const unfilled = asked.filter((held) => held.value.trim() === "")
		if (unfilled.length > 0) {
			throw new Error(
				i18n.t("bots:applications.install.missing", {
					fields: unfilled.map((held) => held.field.name).join(", "),
				}),
			)
		}
		const unrunnable = await port.runnable(application.config)
		if (unrunnable) {
			throw new Error(unrunnable.reason)
		}
		const { owner } = target
		const wasDeclared = await isDeclaredUnder(owner, application.name)
		await declareServer(store, owner, application.name, application.config, {
			title: application.title,
			logo: application.logo,
			logoUrl: application.logoUrl,
		})
		try {
			await writeKeys(owner, application.name, asked)
		} catch (refusal) {
			if (!wasDeclared) {
				await rollBackDeclaration(owner, application.name)
			}
			throw refusal
		}
		if (application.install.kind === "oauth") {
			await target.connect(application.name, urlOf(application))
		}
	}

	return {
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: async () => {
			if (state.isReadingCatalogue || state.curated.length > 0) {
				return
			}
			set({ isReadingCatalogue: true })
			try {
				set({ curated: await port.catalogue(), hasCatalogueFailed: false })
			} catch {
				set({ hasCatalogueFailed: true })
				reportFailure({
					title: i18n.t("bots:applications.catalogue.unavailable"),
				})
			} finally {
				set({ isReadingCatalogue: false })
			}
		},

		browse: () => {
			if (state.query.trim() !== "") {
				return
			}
			scheduleSearch()
		},

		search: (query: string) => {
			set({ query })
			if (query.trim() === "" && openingApplications !== null) {
				showOpening(openingApplications)
				return
			}
			scheduleSearch()
		},

		retry: sendSearch,

		pick: (id: string) => set({ picked: applicationNamed(id), failure: null }),

		leave: () => set({ picked: null, failure: null }),

		install: async (target: InstallTarget, values: InstallValues = {}) => {
			const application = state.picked
			if (
				!application ||
				state.installing !== null ||
				target.declared.includes(application.name)
			) {
				return
			}
			set({ installing: application.name, failure: null })
			try {
				await runInstall(application, target, values)
				await target.settle()
			} catch (reason) {
				set({
					failure: i18n.t("bots:applications.install.failed", {
						reason: refusalTextOf(reason),
					}),
				})
			} finally {
				set({ installing: null })
			}
		},
	}
}
