import { leftOutReason, serverNamed } from "./server-env"
import type { ServerLine, ServerState } from "./system-layer"

import { describeError } from "../../describe-error"
import { askHost } from "../../host"

const SUBTYPE = "connector"
const OPERATION = "report"
const UNRECORDED = "the host kept no record of where a server stands"
const RECORDED = new Set<ServerState>(["holding", "needs-auth", "left-out"])

export type Standing = {
	name: string
	state: ServerState
	reason?: string
}

export const standingOf = ({
	detail,
	state,
}: ServerLine): Standing | undefined => {
	const name = serverNamed(detail)
	if (!name || !RECORDED.has(state)) {
		return undefined
	}
	return state === "left-out"
		? { name, state, reason: leftOutReason(detail) }
		: { name, state }
}

export const recordStanding =
	(session: string | undefined) => (line: ServerLine) => {
		const standing = standingOf(line)
		if (!standing) {
			return
		}
		askHost(session, {
			subtype: SUBTYPE,
			operation: OPERATION,
			payload: standing,
		}).catch((error) => {
			process.stderr.write(
				`${UNRECORDED} ("${standing.name}"): ${describeError(error)}\n`,
			)
		})
	}
