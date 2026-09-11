import type { EnvOwner, EnvScope } from "../conversations/store-contract"

export type ConnectorStatus =
	| { status: "connected" }
	| { status: "needsAuthorization" }
	| { status: "connecting" }
	| { status: "failed"; reason?: string }
	| { status: "unknown" }

export type ConnectorRow = ConnectorStatus & {
	name: string
	scope?: EnvScope
}

export type Disconnected = {
	revoked: boolean
	detail?: string
}

export type ConnectorPort = {
	connect: (owner: EnvOwner, name: string, url: string) => Promise<void>
	cancel: () => Promise<void>
	disconnect: (
		owner: EnvOwner,
		name: string,
		url: string,
	) => Promise<Disconnected>
	status: (owner: EnvOwner) => Promise<ConnectorRow[]>
}
