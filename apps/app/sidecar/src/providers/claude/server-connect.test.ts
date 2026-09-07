import { describe, expect, it } from "bun:test"

import {
	type ConnectPort,
	POLL_BUDGET_MS,
	type ServerStatus,
	UNNAMED_GRACE_MS,
	unconnectedServers,
} from "./server-connect"

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

describe("unconnectedServers", () => {
	it("names the status of the last read and what the reconnection threw", async () => {
		const port = portReading([failed], throwing("Connection failed"))

		const details = await unconnectedServers({ names: ["superset"], port })

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed, and the reconnection answered: Connection failed`,
		])
		expect(port.reconnected).toEqual(["superset"])
	})

	it("reads a server the CLI marks failed at the end of the poll budget", async () => {
		const clock = ticking(250)

		const details = await unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => (clock.now() < POLL_BUDGET_MS ? pending : failed),
				reconnect: throwing("Connection failed"),
			},
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed, and the reconnection answered: Connection failed`,
		])
		expect(clock.now()).toBe(POLL_BUDGET_MS)
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

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([
			`${leftOut}it is still connecting after ${POLL_BUDGET_MS} ms`,
		])
		expect(port.reconnected).toEqual([])
		expect(clock.now()).toBe(POLL_BUDGET_MS)
	})

	it("names the 0 ms a read that landed at once spent on a pending server", async () => {
		const clock = ticking(POLL_BUDGET_MS)
		const port = portReading([pending, []])

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([`${leftOut}it is still connecting after 0 ms`])
	})

	it("takes a single read after the reconnection, and names no wait it never spent", async () => {
		const port = portReading([failed, pending])

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			wait: async () => {},
		})

		expect(details).toEqual([`${leftOut}it is still connecting`])
		expect(port.reads).toBe(2)
		expect(port.reconnected).toEqual(["superset"])
	})

	it("reads the status again while a server stays pending", async () => {
		const port = portReading([pending, connected])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([])
		expect(port.reconnected).toEqual([])
	})

	it("reports nothing when the single reconnect brings the server back", async () => {
		const port = portReading([failed, connected])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([])
		expect(port.reconnected).toEqual(["superset"])
	})

	it("reports its server when the polls and the reconnection both run their bound", async () => {
		const clock = ticking(250)

		const details = await unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => (clock.now() < POLL_BUDGET_MS ? pending : failed),
				reconnect: () => new Promise(() => {}),
			},
			bound: 5,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed, and the reconnection answered: the reconnection outlasted its 5 ms deadline`,
		])
		expect(clock.now()).toBe(POLL_BUDGET_MS)
	})

	it("stops polling once its own reads have spent the poll budget", async () => {
		let time = 0
		let reads = 0

		await unconnectedServers({
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

	it("keeps what the polls read when the read after the reconnection outlasts", async () => {
		const stderr = capture()
		const clock = ticking(250)
		let polling = true

		const details = await unconnectedServers({
			names: ["superset"],
			port: {
				status: () =>
					polling
						? Promise.resolve(clock.now() < POLL_BUDGET_MS ? pending : failed)
						: new Promise(() => {}),
				reconnect: async () => {
					polling = false
				},
			},
			bound: 5,
			now: clock.now,
			wait: clock.wait,
		})
		stderr.restore()

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed`,
		])
		expect(stderr.written).toEqual([
			"the connection pass gave up on superset: a status read outlasted its 5 ms bound\n",
		])
	})

	it("gives up on stderr, reporting nothing, when a status read never settles", async () => {
		const stderr = capture()

		const details = await unconnectedServers({
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

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			now: clock.now,
			wait: clock.wait,
		})

		expect(details).toEqual([`${leftOut}it is still connecting after 8000 ms`])
		expect(clock.now()).toBe(8_000)
	})

	it("stops polling a server no read names at the grace, and reports the named one", async () => {
		const stderr = capture()
		const clock = ticking(250)

		const details = await unconnectedServers({
			names: ["superset", "ghost"],
			port: {
				status: async () => failed,
				reconnect: async () => {},
			},
			now: clock.now,
			wait: clock.wait,
		})
		stderr.restore()

		expect(clock.now()).toBe(UNNAMED_GRACE_MS)
		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed`,
		])
		expect(stderr.written).toEqual([
			"the connection pass gave up on ghost: no status read ever named it\n",
		])
	})

	it("names the status alone when the reconnection threw nothing", async () => {
		const port = portReading([failed])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([
			`${leftOut}two connection attempts failed, it read failed`,
		])
	})

	it("redacts every value the session env store holds, and cuts at 300 characters", async () => {
		const env: ServerEnv = {
			base: { TOKEN: "wide-secret" },
			perServer: { superset: { KEY: "narrow-secret" } },
		}
		const port = portReading(
			[failed],
			throwing(`401 for wide-secret with narrow-secret ${"x".repeat(400)}`),
		)

		const [detail] = await unconnectedServers({
			names: ["superset"],
			port,
			env,
		})
		const opening = `${leftOut}two connection attempts failed, it read failed, and the reconnection answered: `

		expect(detail).toContain(`${opening}401 for [redacted] with [redacted]`)
		expect(detail).not.toContain("wide-secret")
		expect(detail).not.toContain("narrow-secret")
		expect(detail).toHaveLength(opening.length + 300)
	})

	it("leaves a stored value shorter than eight characters out of the redaction", async () => {
		const port = portReading([failed], throwing("dial 127.0.0.1 refused"))

		const [detail] = await unconnectedServers({
			names: ["superset"],
			port,
			env: { base: { PORT: "1", TOKEN: "abcdefgh" } },
		})

		expect(detail).toContain("dial 127.0.0.1 refused")
	})

	it("leaves out the in process server, a disabled server and a session given none", async () => {
		const port = portReading([
			[
				{ name: "kiroshi", status: "failed" },
				{ name: "clock", status: "disabled" },
			],
		])

		expect(await unconnectedServers({ names: ["clock"], port })).toEqual([])
		expect(await unconnectedServers({ names: [], port })).toEqual([])
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

		const details = await unconnectedServers({
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

		const details = await unconnectedServers({ names: ["superset"], port })

		expect(details).toEqual([
			'the server "superset" was left out: it is waiting for you to authorize it',
		])
		expect(port.reconnected).toEqual([])
		expect(port.reads).toBe(1)
	})
})

describe("a server no read ever named", () => {
	it("rides no frame, keeps being polled, and lands on stderr", async () => {
		const port = portReading([[]])
		const stderr = capture()

		const details = await unconnectedServers({
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
