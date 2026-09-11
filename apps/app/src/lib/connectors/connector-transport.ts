import { invoke } from "@tauri-apps/api/core"

import type {
	ConnectorPort,
	ConnectorRow,
	Disconnected,
} from "./connector-port"

export const connectorTransport: ConnectorPort = {
	connect: (owner, name, url) =>
		invoke<void>("mcp_oauth_connect", { owner, name, url }),

	cancel: () => invoke<void>("mcp_oauth_cancel"),

	disconnect: (owner, name, url) =>
		invoke<Disconnected>("mcp_oauth_disconnect", { owner, name, url }),

	status: (owner) => invoke<ConnectorRow[]>("mcp_connector_status", { owner }),
}
