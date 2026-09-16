import { invoke } from "@tauri-apps/api/core"

import type {
	ApplicationRow,
	ConnectionPort,
	Disconnected,
} from "./connection-port"

export const connectionTransport: ConnectionPort = {
	connect: (owner, name, url) =>
		invoke<void>("mcp_oauth_connect", { owner, name, url }),

	cancel: () => invoke<void>("mcp_oauth_cancel"),

	disconnect: (owner, name, url) =>
		invoke<Disconnected>("mcp_oauth_disconnect", { owner, name, url }),

	status: (owner) =>
		invoke<ApplicationRow[]>("mcp_application_status", { owner }),
}
