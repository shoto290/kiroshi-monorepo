import { describe, expect, it, vi } from "vitest"

import {
	type ApplicationPanel,
	reloadPanelsHolding,
} from "./application-panels"

import {
	initialMcpServersState,
	type McpServersState,
} from "../bots/mcp-servers-controller"
import type { EnvOwner } from "../conversations/store-contract"

const panelOf = (owner: EnvOwner | null) => {
	const state: McpServersState = { ...initialMcpServersState, owner }
	const panel: ApplicationPanel = {
		getState: () => state,
		reload: vi.fn(() => Promise.resolve()),
	}
	return panel
}

const reloads = (panel: ApplicationPanel) =>
	vi.mocked(panel.reload).mock.calls.length

describe("reloadPanelsHolding", () => {
	it("re-reads the companion panel holding the companion the install landed on", async () => {
		const companion = panelOf({
			kind: "bot",
			id: "scribe",
			spaceId: "personal",
		})
		const other = panelOf({ kind: "bot", id: "scout", spaceId: "personal" })

		await reloadPanelsHolding({ kind: "companion", id: "scribe" }, [
			companion,
			other,
		])

		expect([reloads(companion), reloads(other)]).toEqual([1, 0])
	})

	it("re-reads the space panel holding the space the install landed on", async () => {
		const space = panelOf({ kind: "space", id: "personal" })

		await reloadPanelsHolding({ kind: "space", id: "personal" }, [space])

		expect(reloads(space)).toBe(1)
	})

	it("re-reads the profile panel holding the user", async () => {
		const profile = panelOf({ kind: "user" })

		await reloadPanelsHolding({ kind: "user" }, [profile])

		expect(reloads(profile)).toBe(1)
	})

	it("leaves every panel as it stands when no panel holds the owner", async () => {
		const profile = panelOf({ kind: "user" })
		const space = panelOf({ kind: "space", id: "personal" })
		const empty = panelOf(null)

		await reloadPanelsHolding({ kind: "companion", id: "scribe" }, [
			profile,
			space,
			empty,
		])

		expect([reloads(profile), reloads(space), reloads(empty)]).toEqual([
			0, 0, 0,
		])
	})
})
