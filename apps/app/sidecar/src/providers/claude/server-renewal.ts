import type { McpSetServersResult } from "@anthropic-ai/claude-agent-sdk"

import { declaredAgain, declaredWithout, type Servers } from "./server-env"

import { askHost } from "../../host"

const SUBTYPE = "standing"
const OPERATION = "renew"
const UNREADABLE = "the host answered the renewal in a shape no reader knows"
const DROPPED_SAID = "the declaration that dropped it removed"
const CARRIED_SAID = "and the one that carried it added"
const NOTHING = "nothing"

export type RenewedGrant =
	| { state: "granted"; accessToken: string }
	| { state: "needs-auth" }
	| { state: "unchanged" }

export type SetServers = Pick<
	McpSetServersResult,
	"added" | "removed" | "errors"
>

export type Declaration = {
	dropped: SetServers
	carried: SetServers
}

export type GrantPort = {
	renew: (name: string) => Promise<RenewedGrant>
	declare: (name: string, accessToken: string) => Promise<Declaration>
}

const listing = (names: string[]): string =>
	names.length ? names.join(", ") : NOTHING

export const unlanded = (
	name: string,
	{ dropped, carried }: Declaration,
): string | undefined => {
	const refused = dropped.errors[name] ?? carried.errors[name]
	if (refused) {
		return refused
	}
	if (dropped.removed.includes(name) && carried.added.includes(name)) {
		return undefined
	}
	return `${DROPPED_SAID} ${listing(dropped.removed)}, ${CARRIED_SAID} ${listing(carried.added)}`
}

export const declaringGrants = (
	opened: Servers,
	set: (servers: Servers) => Promise<SetServers>,
): GrantPort["declare"] => {
	let declared = opened
	let declaring: Promise<unknown> = Promise.resolve()

	const pair = async (
		name: string,
		accessToken: string,
	): Promise<Declaration> => {
		declared = declaredAgain(declared, name, accessToken)
		const dropped = await set(declaredWithout(declared, name))
		const carried = await set(declared)
		return { dropped, carried }
	}

	const heldByTheCaller = () => undefined

	return (name, accessToken) => {
		const queued = declaring.then(() => pair(name, accessToken))
		declaring = queued.then(heldByTheCaller, heldByTheCaller)
		return queued
	}
}

type Answered = {
	state?: unknown
	accessToken?: unknown
}

const grantOf = (answer: unknown): RenewedGrant => {
	const { state, accessToken } = (answer ?? {}) as Answered
	if (state === "granted" && typeof accessToken === "string" && accessToken) {
		return { state, accessToken }
	}
	if (state === "needs-auth" || state === "unchanged") {
		return { state }
	}
	throw new Error(UNREADABLE)
}

export const renewGrant =
	(session: string | undefined) =>
	async (name: string): Promise<RenewedGrant> =>
		grantOf(
			await askHost(session, {
				subtype: SUBTYPE,
				operation: OPERATION,
				payload: { name },
			}),
		)
