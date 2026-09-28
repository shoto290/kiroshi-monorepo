import type {
	ApplicationRow,
	ConnectionPort,
	Disconnected,
} from "./connection-port"

import { invoke } from "../host"

export const connectionTransport: ConnectionPort = {
	connect: (owner, name, url) =>
		invoke<void>("mcp_oauth_connect", { owner, name, url }),

	cancel: () => invoke<void>("mcp_oauth_cancel"),

	disconnect: (owner, name, url) =>
		invoke<Disconnected>("mcp_oauth_disconnect", { owner, name, url }),

	status: (owner) =>
		invoke<ApplicationRow[]>("mcp_application_status", { owner }),
}
