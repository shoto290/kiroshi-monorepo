import { describe, expect, it } from "bun:test"

import {
	type ConnectPass,
	type ConnectPort,
	POLL_BUDGET_MS,
	type ReportedLine,
	type ServerStatus,
	UNNAMED_GRACE_MS,
	unconnectedServers,
	WATCH_BOUND_MS,
	WATCH_POLL_MS,
} from "./server-connect"

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

const throwing = (message: string) => async () => {
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
})
