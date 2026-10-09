import { createContext } from "react"

import type { PromptInputOffline } from "@workspace/ui/components/prompt-input"

import type { JoinedHostState } from "../host/joined-hosts"

export type OpenJoinedHost = {
	spaceName: string
	hostEmail: string
	isOnline: boolean
}

export const isHostOnline = (connection: JoinedHostState | undefined) =>
	connection?.status !== "down"

export const composerOfflineOf = (
	host: OpenJoinedHost | null,
): PromptInputOffline | undefined =>
	host && !host.isOnline
		? { spaceName: host.spaceName, hostName: host.hostEmail }
		: undefined

export const OpenJoinedHostContext = createContext<OpenJoinedHost | null>(null)
