import { askHost } from "../../host"

const SUBTYPE = "standing"
const OPERATION = "renew"
const UNREADABLE = "the host answered the renewal in a shape no reader knows"

export type RenewedGrant =
	| { state: "granted"; accessToken: string }
	| { state: "needs-auth" }
	| { state: "unchanged" }

export type GrantPort = {
	renew: (name: string) => Promise<RenewedGrant>
	declare: (name: string, accessToken: string) => Promise<void>
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
