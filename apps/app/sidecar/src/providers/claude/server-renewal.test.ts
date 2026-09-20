import { afterEach, describe, expect, it } from "bun:test"

import {
	declaringGrants,
	renewGrant,
	type SetServers,
	unlanded,
} from "./server-renewal"

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

const answered = (held: Partial<SetServers>): SetServers => ({
	added: [],
	removed: [],
	errors: {},
	...held,
})

describe("unlanded", () => {
	it("counts a pair that dropped the server then added it back as landed", () => {
		expect(
			unlanded("granola", {
				dropped: answered({ removed: ["granola"] }),
				carried: answered({ added: ["granola"], removed: ["clock"] }),
			}),
		).toBeUndefined()
	})

	it("carries the error either declaration named the server in", () => {
		const dropping = unlanded("granola", {
			dropped: answered({ errors: { granola: "the transport is gone" } }),
			carried: answered({ added: ["granola"] }),
		})
		const carrying = unlanded("granola", {
			dropped: answered({ removed: ["granola"] }),
			carried: answered({ errors: { granola: "the endpoint answered 500" } }),
		})

		expect(dropping).toBe("the transport is gone")
		expect(carrying).toBe("the endpoint answered 500")
	})

	it("carries what each answer named when the pair did not land", () => {
		const neither = unlanded("granola", {
			dropped: answered({ removed: ["clock"] }),
			carried: answered({}),
		})
		const unadded = unlanded("granola", {
			dropped: answered({ removed: ["granola"] }),
			carried: answered({ added: ["clock"] }),
		})

		expect(neither).toBe(
			"the declaration that dropped it removed clock, and the one that carried it added nothing",
		)
		expect(unadded).toBe(
			"the declaration that dropped it removed granola, and the one that carried it added clock",
		)
	})

	it("reads an error naming another server as no refusal of this one", () => {
		expect(
			unlanded("granola", {
				dropped: answered({ removed: ["granola"] }),
				carried: answered({ added: ["granola"], errors: { clock: "gone" } }),
			}),
		).toBeUndefined()
	})
})

describe("declaringGrants", () => {
	const granola = { type: "http" as const, url: "https://mcp.granola.test/mcp" }
	const clock = { type: "http" as const, url: "https://clock.test/mcp" }
	const opened = { granola, clock }

	const sending = (answer: (sent: number) => SetServers) => {
		const sent: Record<string, unknown>[] = []
		const declare = declaringGrants(opened, async (servers) => {
			sent.push(servers)
			return answer(sent.length)
		})
		return { sent, declare }
	}

	it("sends the set without the server, then the set carrying the renewed header", async () => {
		const { sent, declare } = sending((held) =>
			answered(held === 1 ? { removed: ["granola"] } : { added: ["granola"] }),
		)

		const declaration = await declare("granola", "renewed-access-token")

		expect(sent).toEqual([
			{ clock },
			{
				clock,
				granola: {
					...granola,
					headers: { Authorization: "Bearer renewed-access-token" },
				},
			},
		])
		expect(declaration).toEqual({
			dropped: answered({ removed: ["granola"] }),
			carried: answered({ added: ["granola"] }),
		})
	})

	it("carries the header a first pair renewed into a later pair for another server", async () => {
		const { sent, declare } = sending(() => answered({}))

		await declare("granola", "granola-token")
		await declare("clock", "clock-token")

		expect(sent[3]).toEqual({
			granola: {
				...granola,
				headers: { Authorization: "Bearer granola-token" },
			},
			clock: { ...clock, headers: { Authorization: "Bearer clock-token" } },
		})
	})

	it("carries one pair at a time, so no set it sends drops two servers at once", async () => {
		const { sent, declare } = sending(() => answered({}))

		await Promise.all([
			declare("granola", "granola-token"),
			declare("clock", "clock-token"),
		])

		expect(sent).toHaveLength(4)
		for (const servers of sent) {
			expect(Object.keys(servers).length).toBeGreaterThan(0)
		}
	})

	it("carries a pair on after the one before it threw", async () => {
		let sends = 0
		const declare = declaringGrants(opened, async () => {
			sends += 1
			if (sends === 1) {
				throw new Error("the transport is gone")
			}
			return answered({})
		})

		const thrown = await declare("granola", "granola-token").catch(
			(error: Error) => error.message,
		)
		const after = await declare("clock", "clock-token")

		expect(thrown).toBe("the transport is gone")
		expect(after).toEqual({ dropped: answered({}), carried: answered({}) })
	})
})
