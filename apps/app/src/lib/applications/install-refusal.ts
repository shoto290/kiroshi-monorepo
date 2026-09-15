import type { ApplicationInstall } from "./application-port"
import type { ReopenedScope } from "./session-reopening"

import type { ChatError } from "../chat/chat-state"
import { leftOutNameOf } from "../connectors/use-session-connector"

export type RefusingSession = {
	error: ChatError | undefined
	companionId: string | undefined
	spaceId: string | null | undefined
}

export type ScopedInstall = {
	install: ApplicationInstall
	scope: ReopenedScope
}

const reachesSession = (scope: ReopenedScope, session: RefusingSession) => {
	if (scope.kind === "user") {
		return true
	}
	const sessionId =
		scope.kind === "space" ? session.spaceId : session.companionId
	return scope.id === sessionId
}

export const isLeftOutOf = (
	{ install, scope }: ScopedInstall,
	session: RefusingSession,
): boolean =>
	install.install.kind === "key" &&
	leftOutNameOf(session.error) === install.application &&
	reachesSession(scope, session)
