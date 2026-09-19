import type {
	BotMcpConnectionReason,
	BotMcpConnectionState,
	BotMcpServerItem,
} from "@workspace/ui/components/bot-settings"
import type { McpConnectionSection } from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import { readMcpServerLaunch } from "@workspace/ui/components/bot-settings-dialog/mcp-server-launch"

import { toConnectionReason } from "./connection-reason"
import type { ConnectionsState } from "./connections-controller"
import type { Connections } from "./use-connections"

import type { BotMcpServer } from "../conversations/store-contract"

export const APPLICATIONS_TAB = "mcp"

export type ConnectionSettings = {
	mcpServers: BotMcpServerItem[]
	onServerConnect: (server: BotMcpServerItem) => void
	serverConnection?: McpConnectionSection
}

type ConnectionSettingsSource = {
	servers: BotMcpServer[]
	connections: Connections
	openedName: string | null
	onSettled?: (name: string) => void
}

const configOf = ({ config }: BotMcpServer): Record<string, unknown> =>
	typeof config === "object" && config !== null && !Array.isArray(config)
		? config
		: {}

const urlOf = (config: Record<string, unknown>) =>
	readMcpServerLaunch(config).url ?? ""

const keptMarkOf = ({ title, logo, logoUrl }: BotMcpServer) => ({
	displayName: title ?? undefined,
	mark: logo ?? logoUrl ?? undefined,
})

export const hasKeptMark = (server: BotMcpServer) => {
	const { displayName, mark } = keptMarkOf(server)
	return displayName !== undefined || mark !== undefined
}

const hostOf = (url: string) =>
	URL.canParse(url) ? new URL(url).host : undefined

type ApplicationConnection = {
	state?: BotMcpConnectionState
	reason?: BotMcpConnectionReason
}

const connectionOf = (
	state: ConnectionsState,
	name: string,
): ApplicationConnection => {
	if (state.connecting === name) {
		return { state: "connecting" }
	}
	if (state.failure?.command === "connect" && state.failure.name === name) {
		return { state: "failed", reason: toConnectionReason(state.failure.reason) }
	}
	const status = state.rows.find((row) => row.name === name)?.status
	return status === "unknown" ? {} : { state: status }
}

type ConnectionLanding = "connected" | "disconnected"

const isLanded = (
	{ controller }: Connections,
	name: string,
	landing: ConnectionLanding,
) => {
	const isConnected =
		controller.getState().rows.find((row) => row.name === name)?.status ===
		"connected"
	return landing === "connected" ? isConnected : !isConnected
}

const settling =
	(connections: Connections, onSettled?: (name: string) => void) =>
	(name: string, landing: ConnectionLanding, run: Promise<void>) => {
		void run.then(() => {
			if (isLanded(connections, name, landing)) {
				onSettled?.(name)
			}
		})
	}

type ConnectionRuns = (
	name: string,
	landing: ConnectionLanding,
	run: Promise<void>,
) => void

const sectionOf = (
	{ state, controller }: Connections,
	server: BotMcpServer,
	settle: ConnectionRuns,
): McpConnectionSection | undefined => {
	const connection = connectionOf(state, server.name)
	if (!connection.state) {
		return undefined
	}
	const url = urlOf(configOf(server))

	return {
		state: connection.state,
		reason: connection.reason,
		host: hostOf(url),
		onConnect: () => {
			settle(server.name, "connected", controller.connect(server.name, url))
		},
		onCancel: () => {
			void controller.cancel()
		},
		onDisconnect: () => {
			settle(
				server.name,
				"disconnected",
				controller.disconnect(server.name, url),
			)
		},
	}
}

export const toConnectionSettings = ({
	servers,
	connections,
	openedName,
	onSettled,
}: ConnectionSettingsSource): ConnectionSettings => {
	const opened = servers.find((server) => server.name === openedName)
	const settle = settling(connections, onSettled)

	return {
		mcpServers: servers.map((server) => {
			const { state, reason } = connectionOf(connections.state, server.name)
			return {
				name: server.name,
				config: configOf(server),
				...keptMarkOf(server),
				connection: state,
				reason,
			}
		}),
		onServerConnect: (server) => {
			settle(
				server.name,
				"connected",
				connections.controller.connect(server.name, urlOf(server.config)),
			)
		},
		serverConnection: opened && sectionOf(connections, opened, settle),
	}
}
