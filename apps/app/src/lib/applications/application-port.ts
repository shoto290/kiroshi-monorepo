export type InstallField = {
	name: string
	secret: string
	description?: string
	concealed: boolean
}

export type InstallRefusal = {
	field: string
	reason: string
}

export type Install =
	| { kind: "nothing" }
	| { kind: "key"; fields: InstallField[] }
	| { kind: "oauth" }
	| ({ kind: "refused" } & InstallRefusal)

export type AuthPosture = "authRequired" | "noAuth"

export type Application = {
	name: string
	title: string
	description: string
	config: Record<string, unknown>
	tools?: string[]
	logo?: string
	logoUrl?: string
	useCount?: number
	verified?: boolean
	hostedBy?: string
	categories?: string[]
	authPosture?: AuthPosture
	install: Install
}

export type ApplicationsError =
	| { kind: "catalogueUnreadable"; detail: string }
	| { kind: "registryUnreached"; detail: string }
	| { kind: "registryTimedOut" }
	| { kind: "registryRefused"; status: number }
	| { kind: "registryUnreadable"; detail: string }

export type ApplicationSearch = {
	applications: Application[]
	registryFailure?: ApplicationsError
	readAt?: number
	isStale?: boolean
}

export type ApplicationDestination = "companion" | "space" | "user"

export type InstallCase =
	| { kind: "nothing" }
	| { kind: "key"; secrets: string[] }
	| { kind: "oauth" }

export type ApplicationInstall = {
	id: string
	conversationId: string
	application: string
	title: string
	logo?: string
	logoUrl?: string
	description?: string
	scope: ApplicationDestination
	destinationId?: string
	install: InstallCase
	lastMessageSeq: number
	createdAt: number
}

export type ApplicationInstalled = {
	id?: string
	conversationId: string
	application: string
	title: string
	logo?: string
	logoUrl?: string
	description?: string
	scope: ApplicationDestination
	destinationId?: string
	install: InstallCase
	lastMessageSeq?: number
	createdAt?: number
}

export type ApplicationPort = {
	catalogue: () => Promise<Application[]>
	search: (query: string) => Promise<ApplicationSearch>
	named: (name: string) => Promise<Application | null>
	runnable: (config: Record<string, unknown>) => Promise<InstallRefusal | null>
	installs: (conversationId: string) => Promise<ApplicationInstall[]>
	onInstalled: (
		listener: (installed: ApplicationInstalled) => void,
	) => Promise<() => void>
}
