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

export type ApplicationMark = {
	title: string
	mark?: string
}

export type ApplicationMarks = Record<string, ApplicationMark | null>

export const applicationMarkOf = ({
	title,
	logo,
	logoUrl,
}: Application): ApplicationMark => ({
	title,
	mark: logo ?? logoUrl,
})

export type ApplicationsState = {
	curated: Application[]
	marks: ApplicationMarks
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
	resolveMarks: (names: string[]) => void
	install: (target: InstallTarget, values?: InstallValues) => Promise<void>
}

export const initialApplicationsState: ApplicationsState = {
	curated: [],
	marks: {},
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
	const askedNames = new Set<string>()
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

	const recordMark = (name: string, found: Application | null) => {
		set({
			marks: { ...state.marks, [name]: found && applicationMarkOf(found) },
		})
	}

	const askNamed = (name: string) => {
		askedNames.add(name)
		void port.named(name).then(
			(found) => recordMark(name, found),
			() => recordMark(name, null),
		)
	}

	const needsLookup = (name: string) =>
		!askedNames.has(name) && !state.curated.some((held) => held.name === name)

	const applicationNamed = (id: string) =>
		[...state.curated, ...state.registry].find((held) => held.name === id) ??
		null

	const deleteWrittenSecrets = async (owner: EnvOwner, name: string) => {
		const scope = serverScopeOf(owner, name)
		const written = await store.environmentVariables(scope)
		for (const entry of written) {
			if (entry.definedIn.kind === "server") {
				await store.deleteEnvironmentVariable(scope, entry.name)
			}
		}
	}

	const refusalOf = async (step: () => Promise<void>) => {
		try {
			await step()
			return null
		} catch (refusal) {
			return refusal
		}
	}

	const rollBackDeclaration = async (owner: EnvOwner, name: string) => {
		const secretsRefusal = await refusalOf(() =>
			deleteWrittenSecrets(owner, name),
		)
		const undeclareRefusal = await refusalOf(() =>
			undeclareServer(store, owner, name),
		)
		const refusal = undeclareRefusal ?? secretsRefusal
		if (!refusal) {
			return
		}
		reportFailure({
			title: i18n.t("bots:applications.install.rollback.title", { name }),
			description: i18n.t("bots:applications.install.rollback.description", {
				reason: refusalTextOf(refusal),
			}),
		})
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
		const orRollBack = async (step: () => Promise<void>) => {
			try {
				await step()
			} catch (refusal) {
				if (!wasDeclared) {
					await rollBackDeclaration(owner, application.name)
				}
				throw refusal
			}
		}
		await orRollBack(() => writeKeys(owner, application.name, asked))
		if (application.install.kind === "oauth") {
			await orRollBack(() =>
				target.connect(application.name, urlOf(application)),
			)
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

		resolveMarks: (names: string[]) => {
			for (const name of new Set(names)) {
				if (needsLookup(name)) {
					askNamed(name)
				}
			}
		},

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
