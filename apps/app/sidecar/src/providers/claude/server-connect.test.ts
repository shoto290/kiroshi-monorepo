import { describe, expect, it } from "bun:test"

import {
	type ConnectPort,
	type ServerStatus,
	sectionPrefixer,
	unconnectedServers,
} from "./server-connect"
import { unavailableServersSection } from "./system-layer"

import type { ServerEnv } from "../provider"

const portReading = (
	reads: ServerStatus[][],
	reconnect: (name: string) => Promise<void> = async () => {},
): ConnectPort & { reconnected: string[] } => {
	const reconnected: string[] = []
	let read = 0
	return {
		reconnected,
		status: async () => reads[Math.min(read++, reads.length - 1)] ?? [],
		reconnect: async (name) => {
			reconnected.push(name)
			await reconnect(name)
		},
	}
}

const failed = (error?: string): ServerStatus[] => [
	{ name: "superset", status: "failed", ...(error ? { error } : {}) },
]

const connected: ServerStatus[] = [{ name: "superset", status: "connected" }]

describe("unconnectedServers", () => {
	it("reports a server reading failed, and prefixes the first prompt alone", async () => {
		const port = portReading([failed("connect ECONNREFUSED")])

		const details = await unconnectedServers({ names: ["superset"], port })

		expect(details).toEqual([
			'the server "superset" was left out: two connection attempts failed, connect ECONNREFUSED',
		])
		expect(port.reconnected).toEqual(["superset"])

		const prefix = sectionPrefixer(details)
		expect(prefix("what is the plan?")).toBe(
			`${unavailableServersSection(details)}\n\nwhat is the plan?`,
		)
		expect(prefix("and then?")).toBe("and then?")
	})

	it("reads the status again while a server stays pending", async () => {
		const port = portReading([
			[{ name: "superset", status: "pending" }],
			connected,
		])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([])
		expect(port.reconnected).toEqual([])
	})

	it("reports nothing when the single reconnect brings the server back", async () => {
		const port = portReading([failed("timed out"), connected])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([])
		expect(port.reconnected).toEqual(["superset"])
	})

	it("takes the message a thrown reconnect carries as the reason", async () => {
		const port = portReading([failed()], async () => {
			throw new Error("no transport for superset")
		})

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([
			'the server "superset" was left out: two connection attempts failed, no transport for superset',
		])
	})

	it("names no reason when neither the status nor the reconnect gives one", async () => {
		const port = portReading([failed()])

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([
			'the server "superset" was left out: two connection attempts failed, no reason given',
		])
	})

	it("redacts every value the session env store holds, and cuts at 300 characters", async () => {
		const env: ServerEnv = {
			base: { TOKEN: "wide-secret" },
			perServer: { superset: { KEY: "narrow-secret" } },
		}
		const port = portReading([
			failed(`401 for wide-secret with narrow-secret ${"x".repeat(400)}`),
		])

		const [detail] = await unconnectedServers({
			names: ["superset"],
			port,
			env,
		})

		expect(detail).toContain("401 for [redacted] with [redacted]")
		expect(detail).not.toContain("wide-secret")
		expect(detail).not.toContain("narrow-secret")
		expect(detail).toHaveLength(
			'the server "superset" was left out: two connection attempts failed, '
				.length + 300,
		)
	})

	it("leaves out the in process server, a disabled server and a session given none", async () => {
		const port = portReading([
			[
				{ name: "kiroshi", status: "failed", error: "never read" },
				{ name: "clock", status: "disabled" },
			],
		])

		expect(await unconnectedServers({ names: ["clock"], port })).toEqual([])
		expect(await unconnectedServers({ names: [], port })).toEqual([])
		expect(port.reconnected).toEqual([])
	})

	it("reports nothing when reading the status throws", async () => {
		const port: ConnectPort = {
			status: async () => {
				throw new Error("the query is gone")
			},
			reconnect: async () => {},
		}

		expect(await unconnectedServers({ names: ["superset"], port })).toEqual([])
	})
})

describe("sectionPrefixer", () => {
	it("hands every prompt over unchanged when no server is reported", () => {
		const prefix = sectionPrefixer([])

		expect(prefix("first")).toBe("first")
		expect(prefix("second")).toBe("second")
	})
})
