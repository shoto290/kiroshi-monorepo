import type { MockInstance } from "vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createConnectionsController } from "./connections-controller"
import {
	createFakeConnectionPort,
	type FakeConnectionPort,
} from "./fake-connection-port"

import type { EnvOwner } from "../conversations/store-contract"

const SPACE: EnvOwner = { kind: "space", id: "s-1" }

const URL = "https://mcp.atlas.test/mcp"

const DENIED = { kind: "denied", detail: "access_denied" }

const opened = async (port: FakeConnectionPort) => {
	const controller = createConnectionsController(port)
	await controller.open(SPACE)
	return controller
}

const settle = async () => {
	for (let round = 0; round < 10; round += 1) {
		await Promise.resolve()
	}
}

const commandsOf = (port: FakeConnectionPort) =>
	port.calls.map((call) => call.command)

let reported: MockInstance<typeof console.error>

beforeEach(() => {
	reported = vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("connections controller", () => {
	it("reads the status of the owner it opens on", async () => {
		const port = createFakeConnectionPort()
		port.rows.space = [{ name: "atlas", status: "needsAuthorization" }]

		const controller = await opened(port)

		expect(port.calls).toEqual([{ command: "status", owner: SPACE }])
		expect(controller.getState().rows).toEqual(port.rows.space)
	})

	it("holds a connection as connecting until its grant lands, then reads again", async () => {
		const port = createFakeConnectionPort()
		const controller = await opened(port)

		const connecting = controller.connect("atlas", URL)
		await settle()

		expect(controller.getState().connecting).toBe("atlas")
		expect(port.calls.at(-1)).toEqual({
			command: "connect",
			owner: SPACE,
			name: "atlas",
			url: URL,
		})

		port.rows.space = [{ name: "atlas", status: "connected" }]
		port.grant()
		await connecting

		expect(controller.getState().connecting).toBeNull()
		expect(controller.getState().rows).toEqual(port.rows.space)
		expect(commandsOf(port)).toEqual(["status", "connect", "status"])
	})

	it("cancels a running flow and reads again without calling it a failure", async () => {
		const port = createFakeConnectionPort()
		const controller = await opened(port)
		const connecting = controller.connect("atlas", URL)
		await settle()

		await controller.cancel()
		await connecting

		expect(commandsOf(port)).toEqual([
			"status",
			"connect",
			"cancel",
			"status",
			"status",
		])
		expect(controller.getState().connecting).toBeNull()
		expect(controller.getState().failure).toBeNull()
	})

	it("disconnects a connection of the open owner, then reads again", async () => {
		const port = createFakeConnectionPort()
		const controller = await opened(port)

		await controller.disconnect("atlas", URL)

		expect(port.calls.slice(1)).toEqual([
			{ command: "disconnect", owner: SPACE, name: "atlas", url: URL },
			{ command: "status", owner: SPACE },
		])
	})

	it("keeps the reason a refused connect gave", async () => {
		const port = createFakeConnectionPort()
		port.refusals.connect = DENIED
		const controller = await opened(port)

		await controller.connect("atlas", URL)

		expect(controller.getState().failure).toEqual({
			command: "connect",
			name: "atlas",
			reason: DENIED,
		})
		expect(controller.getState().connecting).toBeNull()
	})

	it("keeps the reason a refused disconnect gave", async () => {
		const port = createFakeConnectionPort()
		port.refusals.disconnect = { kind: "alreadyRunning" }
		const controller = await opened(port)

		await controller.disconnect("atlas", URL)

		expect(controller.getState().failure).toEqual({
			command: "disconnect",
			name: "atlas",
			reason: { kind: "alreadyRunning" },
		})
	})

	it("keeps the reason a refused status read gave, until a read comes back", async () => {
		const port = createFakeConnectionPort()
		port.refusals.status = { kind: "io", detail: "locked" }
		const controller = await opened(port)

		expect(controller.getState().failure).toEqual({
			command: "status",
			name: null,
			reason: { kind: "io", detail: "locked" },
		})

		delete port.refusals.status
		await controller.open(SPACE)

		expect(controller.getState().failure).toBeNull()
	})

	it("reports the refusal it stored, once, naming the command and the application", async () => {
		const port = createFakeConnectionPort()
		port.refusals.connect = DENIED
		const controller = await opened(port)

		await controller.connect("atlas", URL)

		expect(reported).toHaveBeenCalledTimes(1)
		expect(reported).toHaveBeenCalledWith(
			"connections: connect was refused for atlas",
			DENIED,
		)
	})

	it("reports a refused status read against the owner it read", async () => {
		const port = createFakeConnectionPort()
		port.refusals.status = { kind: "io", detail: "locked" }
		await opened(port)

		expect(reported).toHaveBeenCalledWith(
			"connections: status was refused for s-1",
			port.refusals.status,
		)
	})

	it("reports nothing when every command lands", async () => {
		const controller = await opened(createFakeConnectionPort())

		await controller.disconnect("atlas", URL)

		expect(reported).not.toHaveBeenCalled()
	})

	it("sends nothing while no owner is open", async () => {
		const port = createFakeConnectionPort()
		const controller = createConnectionsController(port)

		await controller.connect("atlas", URL)
		await controller.cancel()
		await controller.disconnect("atlas", URL)

		expect(port.calls).toEqual([])
	})
})
