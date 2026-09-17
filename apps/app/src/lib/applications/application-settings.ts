import type { BotMcpServerItem } from "@workspace/ui/components/bot-settings"
import { readMcpServerLaunch } from "@workspace/ui/components/bot-settings-dialog/mcp-server-launch"
import type { EnvironmentSection } from "@workspace/ui/components/environment-panel"
import type { InstallableApplication } from "@workspace/ui/components/plugin-settings/application-install-page"
import type {
	ApplicationCategory,
	ApplicationSetup,
	CatalogueApplication,
} from "@workspace/ui/components/plugin-settings/applications-catalogue"
import type { ApplicationsCatalogueSection } from "@workspace/ui/components/plugin-settings/use-mcp-session"
import { i18n } from "@workspace/ui/lib/i18n"

import type { Application, Install } from "./application-port"
import {
	type ApplicationsController,
	type ApplicationsState,
	type InstallTarget,
	serverScopeOf,
} from "./applications-controller"
import {
	type ConnectionSettings,
	toConnectionSettings,
} from "./connection-settings"
import { type SessionReopener, scopeOfOwner } from "./session-reopening"
import type { Applications } from "./use-applications"
import type { Connections } from "./use-connections"

import type { McpServers } from "../bots/use-mcp-servers"
import type { EnvOwner, EnvScope } from "../conversations/store-contract"
import { toEnvironmentRows } from "../environment/environment-rows"
import type { Environment } from "../environment/use-environment"

const EVERYTHING_CATEGORY = "everything"

const SETUP_OF_INSTALL = {
	nothing: "none",
	key: "apiKey",
	oauth: "signIn",
	refused: "unavailable",
} as const satisfies Record<Install["kind"], ApplicationSetup>

const setupOf = (application: Application) =>
	SETUP_OF_INSTALL[application.install.kind]

const askedFieldsOf = ({ install }: Application) =>
	install.kind === "key"
		? install.fields.map(({ name, description, concealed }) => ({
				name,
				description,
				concealed,
			}))
		: []

const refusalOf = ({ install }: Application) =>
	install.kind === "refused"
		? { field: install.field, reason: install.reason }
		: undefined

export const withApplicationMarks = (
	servers: BotMcpServerItem[],
	curated: Application[],
): BotMcpServerItem[] =>
	servers.map((server) => {
		const known = curated.find((held) => held.name === server.name)
		if (!known) {
			return server
		}
		return { ...server, displayName: known.title, mark: known.logo }
	})

const toCatalogueApplication = (
	application: Application,
): CatalogueApplication => ({
	id: application.name,
	name: application.title,
	description: application.description,
	setup: setupOf(application),
	mark: application.logo ?? application.logoUrl,
	useCount: application.useCount,
	isVerified: application.verified,
	host: application.hostedBy,
})

const packageIdentityOf = (application: Application) => {
	const { command, url } = readMcpServerLaunch(application.config)
	return command ?? url ?? undefined
}

const toRegistryApplication = (
	application: Application,
): CatalogueApplication => ({
	...toCatalogueApplication(application),
	packageIdentity: packageIdentityOf(application),
})

export const toInstallableApplication = (
	application: Application,
): InstallableApplication => ({
	...toCatalogueApplication(application),
	description: application.description || undefined,
	packageIdentity: application.name,
	tools: application.tools,
	fields: askedFieldsOf(application).map(
		({ name, description, concealed }) => ({
			name,
			description,
			concealed,
		}),
	),
	refusal: refusalOf(application),
})

const categoriesOf = (count: number | null): ApplicationCategory[] => [
	{
		id: EVERYTHING_CATEGORY,
		label: i18n.t("bots:applications.catalogue.everything"),
		count,
	},
]

const connectFor =
	({ controller }: Connections) =>
	async (name: string, url: string) => {
		await controller.connect(name, url)
		const { failure } = controller.getState()
		if (failure?.command === "connect" && failure.name === name) {
			throw failure.reason
		}
	}

const matching = (applications: Application[], typed: string) =>
	applications.filter((held) =>
		`${held.title} ${held.name} ${held.description}`
			.toLowerCase()
			.includes(typed),
	)

type ApplicationsCatalogueSource = {
	state: ApplicationsState
	controller: ApplicationsController
	target: InstallTarget
}

const toApplicationsCatalogue = ({
	state,
	controller,
	target,
}: ApplicationsCatalogueSource): ApplicationsCatalogueSection => {
	const typed = state.query.trim().toLowerCase()
	const curated = typed === "" ? state.curated : matching(state.curated, typed)
	const { picked } = state

	return {
		categories: categoriesOf(
			state.isReadingCatalogue ? null : state.curated.length,
		),
		category: EVERYTHING_CATEGORY,
		onCategoryChange: () => undefined,
		query: state.query,
		onQueryChange: controller.search,
		curated: curated.map(toCatalogueApplication),
		registry: state.registry.map(toRegistryApplication),
		isCatalogueLoading: state.isReadingCatalogue,
		isRegistrySearching: state.isSearching,
		hasRegistryFailed: state.hasSearchFailed,
		hasRegistryPartlyFailed: state.hasSearchPartlyFailed,
		onRegistryRetry: controller.retry,
		onPick: (application) => controller.pick(application.id),
		install: picked
			? {
					application: toInstallableApplication(picked),
					isInstalling: state.installing === picked.name,
					isInstalled: target.declared.includes(picked.name),
					failure: state.failure ?? undefined,
					onInstall: (values) => {
						void controller.install(target, values)
					},
					onLeave: controller.leave,
				}
			: undefined,
	}
}

export const applicationTitleOf = (curated: Application[], name: string) =>
	curated.find((held) => held.name === name)?.title ?? name

export const openedServerScope = (
	name: string | null,
	owner: EnvOwner | null,
): EnvScope | null => (name && owner ? serverScopeOf(owner, name) : null)

type ServerEnvironmentSource = {
	environment: Environment
	opened: EnvScope | null
	curated: Application[]
	reopen: SessionReopener
}

export const toServerEnvironmentSection = ({
	environment,
	opened,
	curated,
	reopen,
}: ServerEnvironmentSource): EnvironmentSection => {
	const reopenScope = () => {
		if (opened?.kind !== "server") {
			return
		}
		void reopen({
			scope: scopeOfOwner(opened.owner),
			application: applicationTitleOf(curated, opened.name),
		})
	}

	return {
		entries: toEnvironmentRows(environment.state.entries),
		hasFailedToRead: environment.state.hasFailedToRead,
		onSet: ({ name, value }) =>
			environment.controller.set(name, value).then(reopenScope),
		onDelete: environment.controller.remove,
	}
}

type ApplicationScopeSource = {
	applications: Applications
	servers: McpServers
	connections: Connections
	openedName: string | null
	reopen: SessionReopener
}

type ApplicationScope = ConnectionSettings & {
	mcpCatalogue?: ApplicationsCatalogueSection
	onMcpServerCreate: (name: string, config: Record<string, unknown>) => void
	onMcpServerChange: (
		openedName: string,
		name: string,
		config: Record<string, unknown>,
	) => void
	onMcpServerDelete: (name: string) => void
}

export const toApplicationScope = ({
	applications,
	servers,
	connections,
	openedName,
	reopen,
}: ApplicationScopeSource): ApplicationScope => {
	const { curated } = applications.state
	const owner = servers.state.owner

	const reopenFor = (name: string) => {
		if (!owner) {
			return
		}
		void reopen({
			scope: scopeOfOwner(owner),
			application: applicationTitleOf(curated, name),
		})
	}

	const onceWritten = (name: string) => (landed: boolean) => {
		if (landed) {
			reopenFor(name)
		}
	}

	const settleConnection = () => {
		if (openedName) {
			reopenFor(openedName)
		}
	}

	const connectionSettings = toConnectionSettings({
		servers: servers.state.servers,
		connections,
		openedName,
		onSettled: settleConnection,
	})

	const installTarget = (owned: EnvOwner): InstallTarget => ({
		owner: owned,
		declared: servers.state.servers.map((server) => server.name),
		connect: connectFor(connections),
		settle: async () => {
			await servers.controller.reload()
			reopenFor(applications.state.picked?.name ?? "")
		},
	})

	return {
		...connectionSettings,
		mcpServers: withApplicationMarks(connectionSettings.mcpServers, curated),
		mcpCatalogue: owner
			? toApplicationsCatalogue({
					state: applications.state,
					controller: applications.controller,
					target: installTarget(owner),
				})
			: undefined,
		onMcpServerCreate: (name, config) => {
			void servers.controller.create(name, config).then(onceWritten(name))
		},
		onMcpServerChange: (opened, name, config) => {
			void servers.controller
				.rename(opened, name, config)
				.then(onceWritten(name))
		},
		onMcpServerDelete: (name) => {
			void servers.controller.remove(name).then(onceWritten(name))
		},
	}
}
