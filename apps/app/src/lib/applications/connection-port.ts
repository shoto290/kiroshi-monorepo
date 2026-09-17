import type { EnvOwner, EnvScope } from "../conversations/store-contract"

export type ApplicationStatus =
	| { status: "connected" }
	| { status: "needsAuthorization"; reason?: string }
	| { status: "connecting" }
	| { status: "failed"; reason?: string }
	| { status: "unknown" }

export type ApplicationRow = ApplicationStatus & {
	name: string
	scope?: EnvScope
}

export type Disconnected = {
	revoked: boolean
	detail?: string
}

export type ConnectionPort = {
	connect: (owner: EnvOwner, name: string, url: string) => Promise<void>
	cancel: () => Promise<void>
	disconnect: (
		owner: EnvOwner,
		name: string,
		url: string,
	) => Promise<Disconnected>
	status: (owner: EnvOwner) => Promise<ApplicationRow[]>
}
