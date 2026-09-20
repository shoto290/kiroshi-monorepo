import { afterEach, describe, expect, it } from "bun:test"

import { renewGrant } from "./server-renewal"

import type { SessionFrame } from "../provider"
import { closeHostChannel, openHostChannel, settleHostAnswer } from "../../host"

const SESSION = "k1"

const answering = (result: unknown): unknown[] => {
	const asked: unknown[] = []
	openHostChannel(SESSION, (frame: SessionFrame) => {
		const { requestId, request } = frame as {
			requestId: string
			request: unknown
		}
		asked.push(request)
		settleHostAnswer(SESSION, { requestId, result })
	})
	return asked
}

describe("renewGrant", () => {
	afterEach(() => {
		closeHostChannel(SESSION)
	})

	it("names the server under the subtype the host renews grants by", async () => {
		const asked = answering({ state: "unchanged" })

		await renewGrant(SESSION)("superset")

		expect(asked).toEqual([
			{
				subtype: "standing",
				operation: "renew",
				payload: { name: "superset" },
			},
		])
	})

	it("reads each state the host answers a renewal with", async () => {
		const renew = renewGrant(SESSION)
		answering({ state: "granted", accessToken: "renewed-access-token" })
		const granted = await renew("superset")
		closeHostChannel(SESSION)
		answering({ state: "needs-auth" })
		const awaiting = await renew("superset")

		expect(granted).toEqual({
			state: "granted",
			accessToken: "renewed-access-token",
		})
		expect(awaiting).toEqual({ state: "needs-auth" })
	})

	it("refuses an answer naming no state and a grant carrying no token", async () => {
		const renew = renewGrant(SESSION)
		answering({ state: "renewed" })
		const unnamed = renew("superset")
		const unnamedRefusal = await unnamed.catch((error: Error) => error.message)
		closeHostChannel(SESSION)
		answering({ state: "granted" })
		const tokenless = await renew("superset").catch(
			(error: Error) => error.message,
		)

		expect(unnamedRefusal).toContain("no reader knows")
		expect(tokenless).toContain("no reader knows")
	})
})
