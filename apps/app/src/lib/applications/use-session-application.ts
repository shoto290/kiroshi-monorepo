import { createContext } from "react"

import type { ConnectionPort } from "./connection-port"

import type { ChatError } from "../chat/chat-state"
import type { EnvOwner } from "../conversations/store-contract"

export type SessionApplications = {
	port: ConnectionPort
	spaceId: string | null
	onOpen: (owner: EnvOwner) => void
}

export const SessionApplicationsContext =
	createContext<SessionApplications | null>(null)

const LEFT_OUT_SERVER = /^the server "(.+?)" was left out:/

export const leftOutNameOf = (error: ChatError | undefined) =>
	error?.error.kind === "serverEnvRejected"
		? (LEFT_OUT_SERVER.exec(error.error.detail)?.[1] ?? null)
		: null
