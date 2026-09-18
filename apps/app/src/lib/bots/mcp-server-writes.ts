import { pluginScopeOf } from "../conversations/plugin-scope"
import type {
	BotMcpServer,
	EnvOwner,
	McpServerMark,
} from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export const declaredServers = (store: TranscriptStore, owner: EnvOwner) =>
	store.pluginMcpServers(pluginScopeOf(owner))

export const markOf = (
	servers: BotMcpServer[],
	name: string,
): McpServerMark | undefined => {
	const held = servers.find((server) => server.name === name)
	if (!held?.title && !held?.logo && !held?.logoUrl) {
		return undefined
	}
	return { title: held.title, logo: held.logo, logoUrl: held.logoUrl }
}

export const declareServer = (
	store: TranscriptStore,
	owner: EnvOwner,
	name: string,
	config: Record<string, unknown>,
	mark?: McpServerMark,
) => store.setPluginMcpServer(pluginScopeOf(owner), name, config, mark)

export const undeclareServer = (
	store: TranscriptStore,
	owner: EnvOwner,
	name: string,
) => store.deletePluginMcpServer(pluginScopeOf(owner), name)
