import { describe, expect, it } from "bun:test"

import {
	CONNECT_BUDGET_MS,
	type ConnectPort,
	type ServerStatus,
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

	it("reads a server the CLI marks failed at the end of the connect budget", async () => {
		let waited = 0

		const details = await unconnectedServers({
			names: ["superset"],
			port: {
				status: async () => (waited <= CONNECT_BUDGET_MS ? pending : failed),
				reconnect: throwing("Connection failed"),
			},
			wait: async (ms) => {
				waited += ms
			},
		})

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read failed, and the reconnection answered: Connection failed`,
		])
		expect(waited).toBeGreaterThan(CONNECT_BUDGET_MS)
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

	it("waits past five seconds for a server still connecting under the budget", async () => {
		const pending: ServerStatus[] = [{ name: "superset", status: "pending" }]
		let waited = 0
		const port = {
			reconnected: [] as string[],
			status: async () => (waited < 6_000 ? pending : connected),
			reconnect: async (name: string) => {
				port.reconnected.push(name)
			},
		}

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			wait: async (ms) => {
				waited += ms
			},
		})

		expect(details).toEqual([])
		expect(port.reconnected).toEqual([])
		expect(waited).toBeGreaterThan(5_000)
		expect(waited).toBeLessThanOrEqual(CONNECT_BUDGET_MS)
	})

	it("takes a single read after the reconnection, and names the wait it gave", async () => {
		const port = portReading([failed, pending])

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			wait: async () => {},
		})

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read pending after the 15250 ms it was given`,
		])
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

	it("names the wait and what the reconnection threw on a server still pending", async () => {
		const port = portReading([pending], throwing("Server status: pending"))

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			wait: async () => {},
		})

		expect(details).toEqual([
			`${leftOut}two connection attempts failed, it read pending after the 15250 ms it was given, and the reconnection answered: Server status: pending`,
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
		const written: string[] = []
		const original = process.stderr.write
		process.stderr.write = ((line: string) => {
			written.push(String(line))
			return true
		}) as typeof process.stderr.write
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
		process.stderr.write = original

		expect(details).toEqual([])
		expect(written).toEqual([
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

	it("rides no frame, keeps being polled, and lands on stderr", async () => {
		const port = portReading([[]])
		const stderr = capture()

		const details = await unconnectedServers({
			names: ["superset"],
			port,
			wait: async () => {},
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
