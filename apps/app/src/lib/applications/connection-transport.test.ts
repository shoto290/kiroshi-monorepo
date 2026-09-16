import { invoke } from "@tauri-apps/api/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { connectionTransport } from "./connection-transport"

import type { EnvOwner } from "../conversations/store-contract"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

const hostInvoke = vi.mocked(invoke)

const BOT: EnvOwner = { kind: "bot", id: "b-1", spaceId: "s-1" }

const URL = "https://mcp.atlas.test/mcp"

beforeEach(() => {
	hostInvoke.mockReset()
	hostInvoke.mockResolvedValue(undefined)
})

describe("connectionTransport", () => {
	it("hands the host the owner, the connection and its url to connect", async () => {
		await connectionTransport.connect(BOT, "atlas", URL)

		expect(hostInvoke).toHaveBeenCalledWith("mcp_oauth_connect", {
			owner: BOT,
			name: "atlas",
			url: URL,
		})
	})

	it("asks the host to cancel the running flow", async () => {
		await connectionTransport.cancel()

		expect(hostInvoke).toHaveBeenCalledWith("mcp_oauth_cancel")
	})

	it("hands the host the owner, the connection and its url to disconnect", async () => {
		hostInvoke.mockResolvedValue({ revoked: true })

		const disconnected = await connectionTransport.disconnect(BOT, "atlas", URL)

		expect(hostInvoke).toHaveBeenCalledWith("mcp_oauth_disconnect", {
			owner: BOT,
			name: "atlas",
			url: URL,
		})
		expect(disconnected).toEqual({ revoked: true })
	})

	it("names the user as the owner of every call", async () => {
		const user: EnvOwner = { kind: "user" }

		await connectionTransport.status(user)
		await connectionTransport.connect(user, "atlas", URL)
		await connectionTransport.disconnect(user, "atlas", URL)

		expect(hostInvoke.mock.calls).toEqual([
			["mcp_application_status", { owner: user }],
			["mcp_oauth_connect", { owner: user, name: "atlas", url: URL }],
			["mcp_oauth_disconnect", { owner: user, name: "atlas", url: URL }],
		])
	})

	it("reads the connection status of an owner", async () => {
		hostInvoke.mockResolvedValue([{ name: "atlas", status: "connected" }])

		const rows = await connectionTransport.status(BOT)

		expect(hostInvoke).toHaveBeenCalledWith("mcp_application_status", {
			owner: BOT,
		})
		expect(rows).toEqual([{ name: "atlas", status: "connected" }])
	})

	it("hands back what the host refused", async () => {
		hostInvoke.mockRejectedValue({ kind: "alreadyRunning" })

		await expect(
			connectionTransport.connect(BOT, "atlas", URL),
		).rejects.toEqual({ kind: "alreadyRunning" })
	})
})
