import {
	createMcpServersController,
	type McpServersController,
	type McpServersState,
} from "./mcp-servers-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type McpServers = {
	state: McpServersState
	controller: McpServersController
}

export const useMcpServers = (store: TranscriptStore): McpServers =>
	useController(() => createMcpServersController(store))
