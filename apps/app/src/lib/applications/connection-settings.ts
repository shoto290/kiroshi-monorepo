import type {
	BotMcpConnectionState,
	BotMcpServerItem,
} from "@workspace/ui/components/bot-settings"
import type { McpConnectionSection } from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import { readMcpServerLaunch } from "@workspace/ui/components/bot-settings-dialog/mcp-server-launch"

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
	onSettled?: () => void
}

const urlOf = (server: BotMcpServer) =>
	readMcpServerLaunch(server.config).url ?? ""

const hostOf = (url: string) =>
	URL.canParse(url) ? new URL(url).host : undefined

const connectionOf = (
	state: ConnectionsState,
	name: string,
): BotMcpConnectionState | undefined => {
	if (state.connecting === name) {
		return "connecting"
	}
	if (state.failure?.command === "connect" && state.failure.name === name) {
		return "failed"
	}
	const status = state.rows.find((row) => row.name === name)?.status
	return status === "unknown" ? undefined : status
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
	(connections: Connections, onSettled?: () => void) =>
	(name: string, landing: ConnectionLanding, run: Promise<void>) => {
		void run.then(() => {
			if (isLanded(connections, name, landing)) {
				onSettled?.()
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
	if (!connection) {
		return undefined
	}
	const url = urlOf(server)

	return {
		state: connection,
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
		mcpServers: servers.map((server) => ({
			...server,
			connection: connectionOf(connections.state, server.name),
		})),
		onServerConnect: (server) => {
			settle(
				server.name,
				"connected",
				connections.controller.connect(server.name, urlOf(server)),
			)
		},
		serverConnection: opened && sectionOf(connections, opened, settle),
	}
}
