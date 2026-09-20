import { createContext } from "react"

import type { ChatError } from "../chat/chat-state"

export type SessionApplications = {
	spaceId: string | null
}

export const SessionApplicationsContext =
	createContext<SessionApplications | null>(null)

const LEFT_OUT_SERVER = /^the server "(.+?)" was left out:/

export const leftOutNameOf = (error: ChatError | undefined) =>
	error?.error.kind === "serverEnvRejected"
		? (LEFT_OUT_SERVER.exec(error.error.detail)?.[1] ?? null)
		: null
