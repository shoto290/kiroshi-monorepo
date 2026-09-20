import { describe, expect, it } from "bun:test"

import {
	type ConnectPass,
	type ConnectPort,
	POLL_BUDGET_MS,
	type ReportedLine,
	renewedBeforeTurn,
	type ServerStatus,
	UNNAMED_GRACE_MS,
	unconnectedServers,
	WATCH_BOUND_MS,
	WATCH_POLL_MS,
} from "./server-connect"
import type { Declaration, RenewedGrant, SetServers } from "./server-renewal"

import type { ServerEnv } from "../provider"

const portReading = (
	reads: ServerStatus[][],
	reconnect: (name: string) => Promise<void> = async () => {},
): ConnectPort & { reconnected: string[]; reads: number } => {
	const port = {
		reconnected: [] as string[],
		reads: 0,
		status: async () => reads[Math.min(port.reads++, reads.length - 1)] ?? [],
		reconnect: async (name: string) => {
			port.reconnected.push(name)
			await reconnect(name)
		},
	}
	return port
}

const failed: ServerStatus[] = [{ name: "superset", status: "failed" }]

const pending: ServerStatus[] = [{ name: "superset", status: "pending" }]

const awaiting: ServerStatus[] = [{ name: "superset", status: "needs-auth" }]

const connected: ServerStatus[] = [{ name: "superset", status: "connected" }]

const throwing = (message: string) => async (): Promise<never> => {
	throw new Error(message)
}

const ticking = (step: number) => {
	let time = 0
	return {
		now: () => time,
		wait: async () => {
			time += step
		},
	}
}

const LAST_POLL_MS = POLL_BUDGET_MS - 250

const clockedPass = async (
	portFor: (now: () => number) => ConnectPort,
): Promise<string[]> => {
	const reported: string[] = []
	let time = 0

	await unconnectedServers({
		names: ["superset"],
		port: portFor(() => time),
		now: () => time,
		wait: async (ms) => {
			time += ms
		},
		report: (line) => reported.push(line.detail),
	})
	await settling(20)

	return reported
}

const reportedLines = async (pass: ConnectPass): Promise<string[]> =>
	(await unconnectedServers(pass)).map((line) => line.detail)

const settling = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms))

const capture = (): { written: string[]; restore: () => void } => {
	const written: string[] = []
	const original = process.stderr.write
	process.stderr.write = ((line: string) => {
		written.push(String(line))
		return true
	}) as typeof process.stderr.write
	return {
		written,
		restore: () => {
			process.stderr.write = original
		},
	}
}

const leftOut = 'the server "superset" was left out: '

const connecting = 'the server "superset" is still connecting'

describe("unconnectedServers", () => {
	it("names no count of connection attempts in any line it builds", async () => {
		const built = [
			...(await reportedLines({
				names: ["superset"],
				port: portReading([awaiting]),
			})),
			...(await reportedLines({
				names: ["superset"],
				port: portReading([pending]),
				...ticking(250),
			})),
			...(await reportedLines({
				names: ["superset"],
				port: portReading([[{ name: "superset", status: "disabled" }]]),
			})),
		]

		expect(built).toHaveLength(2)
		for (const line of built) {
			expect(line).not.toContain("attempts")
		}
	})

	it("names each server by the status its own read gave it", async () => {
		const clock = ticking(250)
		const port = {
			reconnected: [] as string[],
			status: async () => [
				{ name: "superset", status: "failed" as const },
				{ name: "clock", status: "pending" as const },
			],
			reconnect: async (name: string) => {
				port.reconnected.push(name)
			},
		}

		const details = await reportedLines({
			names: ["superset", "clock"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([
			'the server "superset" read failed, and a reconnection is under way',
			`the server "clock" is still connecting after ${LAST_POLL_MS} ms`,
		])
		expect(clock.now()).toBe(LAST_POLL_MS)
	})

	it("leaves no reconnection pending once the pass is abandoned", async () => {
		const abandoning = new AbortController()
		const passing = unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => failed,
				reconnect: () => new Promise(() => {}),
			},
			signal: abandoning.signal,
			wait: async () => {},
		})

		abandoning.abort()

		expect(await passing).toEqual([])
	})

	it("reconnects no server its reads keep naming pending, and says it is connecting", async () => {
		const clock = ticking(250)
		const port = portReading([pending])

		const details = await reportedLines({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([`${connecting} after ${LAST_POLL_MS} ms`])
		expect(port.reconnected).toEqual([])
		expect(clock.now()).toBe(LAST_POLL_MS)
	})

	it("names the 0 ms a read that landed at once spent on a pending server", async () => {
		const clock = ticking(POLL_BUDGET_MS)
		const port = portReading([pending, []])

		const details = await reportedLines({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([`${connecting} after 0 ms`])
	})

	it("takes no read the time left in the poll budget cannot cover", async () => {
		const stderr = capture()
		let time = 0
		let reads = 0

		const details = await reportedLines({
			names: ["superset"],
			port: {
				status: () => {
					reads += 1
					if (reads > 1) {
						return new Promise(() => {})
					}
					time = LAST_POLL_MS + 1
					return Promise.resolve(pending)
				},
				reconnect: async () => {},
			},
			now: () => time,
			wait: async () => {},
		})
		stderr.restore()

		expect(reads).toBe(1)
		expect(details).toEqual([`${connecting} after ${LAST_POLL_MS + 1} ms`])
		expect(stderr.written).toEqual([])
	})

	it("reports a server pending throughout, on a port answering off a timer", async () => {
		const stderr = capture()
		const clock = ticking(250)
		let reads = 0

		const details = await reportedLines({
			names: ["superset"],
			port: {
				status: () => {
					reads += 1
					return new Promise((resolve) => {
						setTimeout(() => resolve(pending), 1)
					})
				},
				reconnect: async () => {},
			},
			now: clock.now,
			wait: clock.wait,
		})
		stderr.restore()

		expect(details).toEqual([`${connecting} after ${LAST_POLL_MS} ms`])
		expect(stderr.written).toEqual([])
		expect(clock.now()).toBeLessThanOrEqual(POLL_BUDGET_MS)
		expect(reads).toBe(LAST_POLL_MS / 250 + 1)
	})

	it("names in a give up only the servers it holds no read for", async () => {
		const stderr = capture()
		const clock = ticking(250)
		let reads = 0

		const details = await reportedLines({
			names: ["superset", "clock"],
			port: {
				status: () => {
					reads += 1
					return reads > 1 ? new Promise(() => {}) : Promise.resolve(pending)
				},
				reconnect: async () => {},
			},
			bound: 5,
			now: clock.now,
			wait: clock.wait,
		})
		stderr.restore()

		expect(details).toEqual([`${connecting} after 0 ms`])
		expect(stderr.written).toEqual([
			"the connection pass gave up on clock: a status read outlasted its 5 ms bound\n",
		])
	})

	it("reads the status again while a server stays pending", async () => {
		const port = portReading([pending, connected])

		expect(await reportedLines({ names: ["superset"], port })).toEqual([])
		expect(port.reconnected).toEqual([])
	})

	it("stops polling once its own reads have spent the poll budget", async () => {
		let time = 0
		let reads = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => {
					reads += 1
					time += POLL_BUDGET_MS / 2
					return pending
				},
				reconnect: async () => {},
			},
			now: () => time,
			wait: async () => {},
		})

		expect(reads).toBe(2)
		expect(time).toBe(POLL_BUDGET_MS)
	})

	it("claims no server still connecting was left out of the session", async () => {
		const clock = ticking(250)

		const [detail] = await reportedLines({
			names: ["superset"],
			port: portReading([pending]),
			now: clock.now,
			wait: clock.wait,
		})

		expect(detail).toBe(`${connecting} after ${LAST_POLL_MS} ms`)
		expect(detail).not.toContain("left out")
	})

	it("gives up on stderr, reporting nothing, when a status read never settles", async () => {
		const stderr = capture()

		const details = await reportedLines({
			names: ["superset"],
			port: {
				status: () => new Promise(() => {}),
				reconnect: async () => {},
			},
			bound: 5,
		})
		stderr.restore()

		expect(details).toEqual([])
		expect(stderr.written).toEqual([
			"the connection pass gave up on superset: a status read outlasted its 5 ms bound\n",
		])
	})

	it("names in a reason the wait its clock advanced, not the sleeps it counted", async () => {
		const clock = ticking(8_000)
		const port = portReading([pending, pending, []])

		const details = await reportedLines({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([`${connecting} after 8000 ms`])
		expect(clock.now()).toBe(8_000)
	})

	it("stops polling a server no read names at the grace, and reports the named one", async () => {
		const stderr = capture()
		const clock = ticking(250)

		const details = await reportedLines({
			names: ["superset", "ghost"],
			port: {
				status: async () => awaiting,
				reconnect: async () => {},
			},
			now: clock.now,
			wait: clock.wait,
		})
		stderr.restore()

		expect(clock.now()).toBe(UNNAMED_GRACE_MS)
		expect(details).toEqual([`${leftOut}it is waiting for you to authorize it`])
		expect(stderr.written).toEqual([
			"the connection pass gave up on ghost: no status read ever named it\n",
		])
	})

	it("leaves out the in process server, a disabled server and a session given none", async () => {
		const port = portReading([
			[
				{ name: "kiroshi", status: "failed" },
				{ name: "clock", status: "disabled" },
			],
		])

		expect(await reportedLines({ names: ["clock"], port })).toEqual([])
		expect(await reportedLines({ names: [], port })).toEqual([])
		expect(port.reconnected).toEqual([])
	})

	it("names on stderr the servers it gave up on when the status throws", async () => {
		const stderr = capture()
		const port: ConnectPort = {
			status: async () => {
				throw new Error("the query is gone")
			},
			reconnect: async () => {},
		}

		const details = await reportedLines({
			names: ["superset", "clock"],
			port,
		})
		stderr.restore()

		expect(details).toEqual([])
		expect(stderr.written).toEqual([
			"the connection pass gave up on superset, clock: the query is gone\n",
		])
	})

	it("names a server waiting for authorization, and reconnects it by no call", async () => {
		const port = portReading([[{ name: "superset", status: "needs-auth" }]])

		const lines = await unconnectedServers({ names: ["superset"], port })

		expect(lines).toEqual([
			{
				detail:
					'the server "superset" was left out: it is waiting for you to authorize it',
				state: "needs-auth",
				notice: true,
			},
		])
		expect(port.reconnected).toEqual([])
		expect(port.reads).toBe(1)
	})
})

describe("a server no read ever named", () => {
	it("rides no frame, keeps being polled, and lands on stderr", async () => {
		const port = portReading([[]])
		const stderr = capture()

		const details = await reportedLines({
			names: ["superset"],
			port,
			...ticking(250),
		})
		stderr.restore()

		expect(details).toEqual([])
		expect(port.reads).toBeGreaterThan(1)
		expect(stderr.written).toEqual([
			"the connection pass gave up on superset: no status read ever named it\n",
		])
	})

	it("writes nothing and reports nothing once the pass is abandoned", async () => {
		const abandoning = new AbortController()
		const port = portReading([[{ name: "superset", status: "pending" }]])
		const stderr = capture()

		const passing = unconnectedServers({
			names: ["superset"],
			port,
			signal: abandoning.signal,
			wait: async () => {},
		})
		abandoning.abort()
		const details = await passing
		stderr.restore()

		expect(details).toEqual([])
		expect(stderr.written).toEqual([])
	})
})

describe("watching a server left connecting", () => {
	const watched = async (
		settles: ServerStatus[],
		reconnect: (name: string) => Promise<void> = async () => {},
		signal?: AbortSignal,
	) => {
		const reported: string[] = []
		const reconnected: string[] = []
		let time = 0
		let reads = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => {
					reads += 1
					return time <= LAST_POLL_MS ? pending : settles
				},
				reconnect: async (name) => {
					reconnected.push(name)
					await reconnect(name)
				},
			},
			signal,
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line.detail),
		})
		const spentReads = reads
		await settling()

		return { reported, reconnected, spentReads, reads: () => reads }
	}

	it("marks a server a later read settles as waiting for authorization as needs-auth", async () => {
		const reported: ReportedLine[] = []
		let time = 0

		await unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => (time <= LAST_POLL_MS ? pending : awaiting),
				reconnect: async () => {},
			},
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line),
		})
		await settling()

		expect(reported).toEqual([
			{
				detail: `${leftOut}it is waiting for you to authorize it`,
				state: "needs-auth",
				notice: true,
			},
		])
	})

	it("reconnects a server the CLI settles failed after the budget, once", async () => {
		const { reported, reconnected } = await watched(
			failed,
			throwing("Connection failed"),
		)

		expect(reported).toEqual([
			`${leftOut}it read failed, and the reconnection answered: Connection failed`,
		])
		expect(reconnected).toEqual(["superset"])
	})

	it("keeps the reconnection's answer for the read that settles it later", async () => {
		const reconnected: string[] = []
		let dialledReads = 0

		const reported = await clockedPass(() => ({
			status: async () => {
				if (reconnected.length === 0) {
					return failed
				}
				dialledReads += 1
				return dialledReads < 3 ? pending : failed
			},
			reconnect: async (name) => {
				reconnected.push(name)
				throw new Error("server not found")
			},
		}))

		expect(dialledReads).toBeGreaterThan(1)
		expect(reconnected).toEqual(["superset"])
		expect(reported).toEqual([
			`${leftOut}it read failed, and the reconnection answered: server not found`,
		])
	})

	it("names the read that threw as the source, claiming no answer of the reconnection", async () => {
		let dialled = false

		const reported = await clockedPass(() => ({
			status: async () => {
				if (!dialled) {
					return failed
				}
				throw new Error("the query stalled")
			},
			reconnect: async () => {
				dialled = true
			},
		}))

		expect(reported).toEqual([
			`${leftOut}it read failed, and the status read that followed it answered: the query stalled`,
		])
	})

	it("keeps reading, and names no server left out, when a watch read throws", async () => {
		const stderr = capture()
		let stalled = false

		const reported = await clockedPass((now) => ({
			status: async () => {
				if (now() <= LAST_POLL_MS) {
					return pending
				}
				if (!stalled) {
					stalled = true
					throw new Error("the query stalled")
				}
				return connected
			},
			reconnect: async () => {},
		}))
		stderr.restore()

		expect(stalled).toBe(true)
		expect(reported).toEqual([
			'the server "superset" connected, and holds its tools for the rest of this session',
		])
		expect(stderr.written).toEqual([
			"the status of this session's servers could not be read: the query stalled\n",
		])
	})

	it("reports by the read it takes after a reconnection that brought a server back", async () => {
		const reconnected: string[] = []
		let dialled = false

		const reported = await clockedPass((now) => ({
			status: async () => {
				if (dialled) {
					return connected
				}
				return now() <= LAST_POLL_MS ? pending : failed
			},
			reconnect: async (name) => {
				reconnected.push(name)
				dialled = true
			},
		}))

		expect(reported).toEqual([
			'the server "superset" connected, and holds its tools for the rest of this session',
		])
		expect(reconnected).toEqual(["superset"])
	})

	it("reads a server left pending again while a reconnection still hangs", async () => {
		const reported: string[] = []
		let time = 0
		let reads = 0
		let dialled = false

		await reportedLines({
			names: ["superset", "clock"],
			port: {
				status: async () => {
					reads += 1
					return [
						{ name: "superset", status: "failed" },
						{ name: "clock", status: "pending" },
					]
				},
				reconnect: () => {
					dialled = true
					return new Promise(() => {})
				},
			},
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line.detail),
		})
		const budgeted = reads
		await settling(20)

		expect(dialled).toBe(true)
		expect(reads).toBeGreaterThan(budgeted)
		expect(reported).toEqual([
			'the server "clock" was left out: it never settled while it was watched',
		])
	})

	it("reports a server its dial hands back after the bound had passed", async () => {
		const stderr = capture()
		let dialled = false

		const reported = await clockedPass((now) => ({
			status: async () => {
				if (!dialled) {
					return now() <= LAST_POLL_MS ? pending : failed
				}
				return pending
			},
			reconnect: async () => {
				dialled = true
				await new Promise((resolve) => setTimeout(resolve, 15))
				throw new Error("server not found")
			},
		}))
		stderr.restore()

		expect(reported).toEqual([
			`${leftOut}it never settled while it was watched, and the reconnection answered: server not found`,
		])
	})

	it("gives up on a dialled server with the answer its reconnection gave", async () => {
		const stderr = capture()
		let dialled = false

		const reported = await clockedPass((now) => ({
			status: async () => {
				if (!dialled) {
					return now() <= LAST_POLL_MS ? pending : failed
				}
				return pending
			},
			reconnect: async () => {
				dialled = true
				throw new Error("server not found")
			},
		}))
		stderr.restore()

		expect(reported).toEqual([
			`${leftOut}it never settled while it was watched, and the reconnection answered: server not found`,
		])
	})

	it("stops watching at its bound and names on stderr what it left unsettled", async () => {
		const stderr = capture()
		const reported: string[] = []
		let time = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => pending,
				reconnect: async () => {},
			},
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line.detail),
		})
		await settling(20)
		stderr.restore()

		expect(reported).toEqual([
			'the server "superset" was left out: it never settled while it was watched',
		])
		expect(stderr.written).toEqual([
			"the connection pass gave up on superset: it never settled while it was watched\n",
		])
		expect(time).toBeGreaterThanOrEqual(WATCH_BOUND_MS)
	})

	it("names a server the CLI settles connected after the budget as reached", async () => {
		const { reported, reconnected } = await watched(connected)

		expect(reported).toEqual([
			'the server "superset" connected, and holds its tools for the rest of this session',
		])
		expect(reconnected).toEqual([])
	})

	it("names a server waiting for authorization, without reconnecting it", async () => {
		const { reported, reconnected } = await watched([
			{ name: "superset", status: "needs-auth" },
		])

		expect(reported).toEqual([
			'the server "superset" was left out: it is waiting for you to authorize it',
		])
		expect(reconnected).toEqual([])
	})

	it("takes no read and reports nothing once the session closed", async () => {
		const abandoning = new AbortController()
		const reported: string[] = []
		const reconnected: string[] = []
		let time = 0
		let reads = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => {
					reads += 1
					return time <= LAST_POLL_MS ? pending : failed
				},
				reconnect: async (name) => {
					reconnected.push(name)
				},
			},
			signal: abandoning.signal,
			now: () => time,
			wait: async (ms) => {
				time += ms
				if (ms === WATCH_POLL_MS) {
					await new Promise((resolve) => setTimeout(resolve, 20))
				}
			},
			report: (line) => reported.push(line.detail),
		})
		const budgeted = reads
		abandoning.abort()
		await settling(40)

		expect(reported).toEqual([])
		expect(reconnected).toEqual([])
		expect(reads).toBe(budgeted)
	})

	it("redacts a stored value out of the answer, and cuts it at 300 characters", async () => {
		const reported: string[] = []
		let time = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => (time <= LAST_POLL_MS ? pending : failed),
				reconnect: throwing(`401 for wide-secret ${"x".repeat(400)}`),
			},
			env: { base: { TOKEN: "wide-secret" } },
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line.detail),
		})
		await settling()

		const opening = `${leftOut}it read failed, and the reconnection answered: `

		expect(reported[0]).toContain(`${opening}401 for [redacted]`)
		expect(reported[0]).toHaveLength(opening.length + 300)
	})

	it("cuts a url of the answer back to its scheme, its host and its path", async () => {
		const reported: string[] = []
		let time = 0

		await reportedLines({
			names: ["superset"],
			port: {
				status: async () => (time <= LAST_POLL_MS ? pending : failed),
				reconnect: throwing(
					"401 from https://queried.test/mcp?api_key=sk-live-1234#tail",
				),
			},
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line.detail),
		})
		await settling()

		expect(reported[0]).toContain("401 from https://queried.test/mcp")
		expect(reported[0]).not.toContain("api_key")
		expect(reported[0]).not.toContain("sk-live-1234")
	})
})

const REJECTED_HEADER =
	"Server rejected the configured Authorization header (HTTP 401). Check that the token is valid for this MCP endpoint — OAuth fallback is disabled when headers.Authorization is set."

const RENEWED = "renewed-access-token"

const GIVEN_A_TOKEN: ServerEnv = {
	perServer: { superset: { KIROSHI_OAUTH_ACCESS_TOKEN: "stale-access-token" } },
}

const rejecting = (error: string): ServerStatus[] => [
	{ name: "superset", status: "failed", error },
]

const setServers = (answered: Partial<SetServers>): SetServers => ({
	added: [],
	removed: [],
	errors: {},
	...answered,
})

const LANDED: Declaration = {
	dropped: setServers({ removed: ["superset"] }),
	carried: setServers({ added: ["superset"] }),
}

type RenewalPass = {
	statuses: (declared: boolean) => Promise<ServerStatus[]>
	grant?: () => Promise<RenewedGrant>
	declare?: (name: string, accessToken: string) => Promise<Declaration>
	env?: ServerEnv
}

const renewalPass = async ({
	statuses,
	grant = async () => ({ state: "granted", accessToken: RENEWED }),
	declare = async () => LANDED,
	env = GIVEN_A_TOKEN,
}: RenewalPass) => {
	const reported: ReportedLine[] = []
	const renewed: string[] = []
	const reconnected: string[] = []
	const declared: { name: string; accessToken: string }[] = []
	let time = 0
	const stderr = capture()

	await unconnectedServers({
		names: ["superset"],
		port: {
			status: () => statuses(declared.length > 0),
			reconnect: async (name) => {
				reconnected.push(name)
			},
		},
		env,
		grants: {
			renew: async (name) => {
				renewed.push(name)
				return grant()
			},
			declare: async (name, accessToken) => {
				declared.push({ name, accessToken })
				return declare(name, accessToken)
			},
		},
		now: () => time,
		wait: async (ms) => {
			time += ms
		},
		report: (line) => reported.push(line),
	})
	await settling(20)
	stderr.restore()

	return { reported, renewed, reconnected, declared, written: stderr.written }
}

const backAfterRenewal = (error: string) => async (declared: boolean) =>
	declared ? connected : rejecting(error)

describe("a rejected access token", () => {
	it("is renewed on the reason the agent SDK writes for a rejected header", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
		})

		expect(pass.renewed).toEqual(["superset"])
		expect(pass.declared).toEqual([{ name: "superset", accessToken: RENEWED }])
		expect(pass.reconnected).toEqual([])
		expect(pass.reported).toEqual([
			{
				detail:
					'the server "superset" connected, and holds its tools for the rest of this session',
				state: "holding",
				notice: false,
			},
		])
	})

	it("is renewed on a reason naming the rejected header and no status", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(
				"the endpoint rejected the configured Authorization header",
			),
		})

		expect(pass.renewed).toEqual(["superset"])
		expect(pass.reconnected).toEqual([])
	})

	it("is renewed on a reason naming a 401 and no header", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal("the endpoint answered 401 Unauthorized"),
		})

		expect(pass.renewed).toEqual(["superset"])
		expect(pass.reconnected).toEqual([])
	})

	it("is renewed at most once for one failed status, however it settles", async () => {
		const pass = await renewalPass({
			statuses: async () => rejecting(REJECTED_HEADER),
		})

		expect(pass.renewed).toEqual(["superset"])
		expect(pass.reconnected).toEqual([])
		expect(pass.reported).toEqual([
			{ detail: `${leftOut}it read failed`, state: "left-out", notice: true },
		])
	})

	it("is left to the reconnection it takes today when no 401 is named", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal("Connection refused"),
		})

		expect(pass.renewed).toEqual([])
		expect(pass.reconnected).toEqual(["superset"])
	})

	it("is renewed for no server the store gave an access token to", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			env: { perServer: { clock: { KIROSHI_OAUTH_ACCESS_TOKEN: "clock" } } },
		})

		expect(pass.renewed).toEqual([])
		expect(pass.reconnected).toEqual(["superset"])
	})

	it("leaves a server the authorization server refuses waiting to be authorized", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			grant: async () => ({ state: "needs-auth" }),
		})

		expect(pass.declared).toEqual([])
		expect(pass.reconnected).toEqual([])
		expect(pass.reported).toEqual([
			{
				detail: `${leftOut}it is waiting for you to authorize it`,
				state: "needs-auth",
				notice: true,
			},
		])
	})

	it("carries the reason it reports today when the renewal answers no token", async () => {
		const reported: ReportedLine[] = []
		let time = 0

		await unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => rejecting(REJECTED_HEADER),
				reconnect: throwing("Connection failed"),
			},
			env: GIVEN_A_TOKEN,
			grants: {
				renew: async () => ({ state: "unchanged" }),
				declare: async () => LANDED,
			},
			now: () => time,
			wait: async (ms) => {
				time += ms
			},
			report: (line) => reported.push(line),
		})
		await settling(20)

		expect(reported.map((line) => line.detail)).toEqual([
			`${leftOut}it read failed, and the reconnection answered: Connection failed`,
		])
	})

	it("leaves the server out, naming the declaration, when declaring it throws", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			declare: throwing(`${RENEWED} is refused`),
		})

		expect(pass.reported).toEqual([
			{
				detail: `${leftOut}it read failed, and the declaration that carried it answered: [redacted] is refused`,
				state: "left-out",
				notice: true,
			},
		])
	})

	it("is redacted out of every reported line and every line on stderr", async () => {
		const pass = await renewalPass({
			statuses: async (declared) => {
				if (!declared) {
					return rejecting(REJECTED_HEADER)
				}
				throw new Error(`the query stalled on ${RENEWED}`)
			},
		})
		const carried = [
			...pass.written,
			...pass.reported.map((line) => line.detail),
		].join("")

		expect(carried).toContain("the query stalled on [redacted]")
		expect(carried).not.toContain(RENEWED)
	})

	it("writes on stderr, and reconnects, when the host refuses to renew", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			grant: throwing("the session closed before the host answered"),
		})

		expect(pass.written.join("")).toContain(
			'the renewal of a rejected access token was refused ("superset"): the session closed before the host answered',
		)
		expect(pass.reconnected).toEqual(["superset"])
	})
})

describe("a declaration that carries a renewed header", () => {
	it("is left out carrying what the answers said when the pair did not land", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			declare: async () => ({
				dropped: setServers({}),
				carried: setServers({ added: ["superset"] }),
			}),
		})

		expect(pass.reported).toEqual([
			{
				detail: `${leftOut}it read failed, and the declaration that carried it answered: the declaration that dropped it removed nothing, and the one that carried it added superset`,
				state: "left-out",
				notice: true,
			},
		])
	})

	it("is left out carrying the error a declaration named the server in", async () => {
		const pass = await renewalPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			declare: async () => ({
				dropped: setServers({ removed: ["superset"] }),
				carried: setServers({
					errors: { superset: "the endpoint answered 500" },
				}),
			}),
		})

		expect(pass.reported).toEqual([
			{
				detail: `${leftOut}it read failed, and the declaration that carried it answered: the endpoint answered 500`,
				state: "left-out",
				notice: true,
			},
		])
	})
})

type TurnPass = {
	statuses: (declared: boolean) => Promise<ServerStatus[]>
	names?: string[]
	grant?: () => Promise<RenewedGrant>
	env?: ServerEnv
	grants?: boolean
}

const turnPass = async ({
	statuses,
	names = ["superset"],
	grant = async () => ({ state: "granted", accessToken: RENEWED }),
	env = GIVEN_A_TOKEN,
	grants = true,
}: TurnPass) => {
	const reported: ReportedLine[] = []
	const renewed: string[] = []
	const reconnected: string[] = []
	const declared: { name: string; accessToken: string }[] = []
	let reads = 0
	let time = 0
	const stderr = capture()

	await renewedBeforeTurn({
		names,
		port: {
			status: () => {
				reads += 1
				return statuses(declared.length > 0)
			},
			reconnect: async (name) => {
				reconnected.push(name)
			},
		},
		env,
		...(grants
			? {
					grants: {
						renew: async (name: string) => {
							renewed.push(name)
							return grant()
						},
						declare: async (name: string, accessToken: string) => {
							declared.push({ name, accessToken })
							return LANDED
						},
					},
				}
			: {}),
		now: () => time,
		wait: async (ms: number) => {
			time += ms
		},
		report: (line) => reported.push(line),
	})
	stderr.restore()

	return {
		reported,
		renewed,
		reconnected,
		declared,
		reads,
		written: stderr.written,
	}
}

describe("renewedBeforeTurn", () => {
	it("reads the status once and renews nothing when no server reads failed", async () => {
		const turn = await turnPass({ statuses: async () => connected })

		expect(turn.reads).toBe(1)
		expect(turn.renewed).toEqual([])
		expect(turn.reported).toEqual([])
	})

	it("renews and declares a server reading failed on a rejected header", async () => {
		const turn = await turnPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
		})

		expect(turn.renewed).toEqual(["superset"])
		expect(turn.declared).toEqual([{ name: "superset", accessToken: RENEWED }])
		expect(turn.reported).toEqual([
			{
				detail:
					'the server "superset" connected, and holds its tools for the rest of this session',
				state: "holding",
				notice: false,
			},
		])
	})

	it("renews a given server no more than once for one turn", async () => {
		const turn = await turnPass({
			statuses: async () => rejecting(REJECTED_HEADER),
		})

		expect(turn.renewed).toEqual(["superset"])
		expect(turn.declared).toHaveLength(1)
	})

	it("renews neither a server no 401 names nor one the store gave no token", async () => {
		const unnamed = await turnPass({
			statuses: backAfterRenewal("Connection refused"),
		})
		const untokened = await turnPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			env: {},
		})

		expect([...unnamed.renewed, ...untokened.renewed]).toEqual([])
		expect([...unnamed.reconnected, ...untokened.reconnected]).toEqual([])
		expect([...unnamed.reported, ...untokened.reported]).toEqual([])
	})

	it("reads no status at all for a session wired with no grant port", async () => {
		const turn = await turnPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			grants: false,
		})

		expect(turn.reads).toBe(0)
	})

	it("renews no server the session was not opened with", async () => {
		const turn = await turnPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			names: ["clock"],
		})

		expect(turn.renewed).toEqual([])
	})

	it("names a server still connecting after the declaration, without a notice", async () => {
		const turn = await turnPass({
			statuses: async (declared) =>
				declared ? pending : rejecting(REJECTED_HEADER),
		})

		expect(turn.reported).toEqual([
			{
				detail: 'the server "superset" is still connecting after 0 ms',
				state: "connecting",
				notice: false,
			},
		])
	})

	it("hands the turn on, saying so on stderr, when the status cannot be read", async () => {
		const turn = await turnPass({ statuses: throwing("the query is gone") })

		expect(turn.renewed).toEqual([])
		expect(turn.reported).toEqual([])
		expect(turn.written.join("")).toContain(
			"the status of this session's servers could not be read: the query is gone",
		)
	})

	it("leaves a refused grant waiting to be authorized before the turn", async () => {
		const turn = await turnPass({
			statuses: backAfterRenewal(REJECTED_HEADER),
			grant: async () => ({ state: "needs-auth" }),
		})

		expect(turn.declared).toEqual([])
		expect(turn.reported).toEqual([
			{
				detail: `${leftOut}it is waiting for you to authorize it`,
				state: "needs-auth",
				notice: true,
			},
		])
	})
})
