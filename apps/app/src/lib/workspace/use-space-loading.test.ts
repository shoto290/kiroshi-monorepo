// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useSpaceLoading } from "./use-space-loading"

import type { JoinedSpace } from "@/lib/bindings"
import { createFakeTranscriptStore } from "@/lib/conversations/fake-transcript-store"
import type { JoinedHostsState } from "@/lib/host/joined-hosts"
import {
	createJoinedSpacesController,
	openRowIdOf,
} from "@/lib/spaces/joined-spaces-controller"
import { createSpacesController } from "@/lib/spaces/spaces-controller"
import { createStore } from "@/lib/store"

const HOST_PERSONAL: JoinedSpace = {
	id: "joined-personal",
	hostUrl: "http://192.168.1.22:45367",
	remoteSpaceId: "personal",
	name: "Personal",
}

const HOST_PERSONAL_ROW = "joined:joined-personal"

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const hostsFake = () => {
	const store = createStore<JoinedHostsState>({ active: null, connections: {} })
	return {
		getState: store.getState,
		subscribe: store.subscribe,
		connect: vi.fn(async () => undefined),
		activate: vi.fn(async (active: string | null) => {
			store.setState({ ...store.getState(), active })
		}),
		forget: vi.fn(),
	}
}

const transportOf = (listed: JoinedSpace[]) => ({
	list: vi.fn(async () => listed),
	add: vi.fn(),
	remove: vi.fn(async () => undefined),
	onChanged: vi.fn(async () => () => undefined),
	onRemoved: vi.fn(async () => () => undefined),
})

const gearFor = async () => {
	const spaces = createSpacesController(createFakeTranscriptStore())
	await spaces.load(null)
	const hosts = hostsFake()
	const joined = createJoinedSpacesController({
		spaces,
		hosts,
		transport: transportOf([HOST_PERSONAL]),
	})
	joined.watch()
	await settle()
	const roster = { load: vi.fn(async () => undefined), enter: vi.fn() }
	const user = {
		getState: () => ({
			preferences: {
				lastSpaceId: null,
				lastBotIdBySpace: {
					personal: "local-bot",
					[HOST_PERSONAL_ROW]: "host-bot",
				},
			},
		}),
		setLastSpace: vi.fn(async () => undefined),
	}
	const inputOf = () => {
		const { selectedSpaceId } = spaces.getState()
		return {
			core: {
				joinedSpaces: {
					state: joined.getState(),
					controller: joined,
					hosts: hosts.getState(),
				},
				roster: { controller: roster },
				spaces: { state: spaces.getState(), controller: spaces },
				user: { controller: user },
			},
			scopes: {
				selectedSpaceId,
				openRowId: openRowIdOf(joined.getState(), selectedSpaceId),
			},
		} as never
	}
	const view = renderHook((input) => useSpaceLoading(input), {
		initialProps: inputOf(),
	})
	await act(settle)
	const switchTo = async (rowId: string) => {
		roster.load.mockClear()
		roster.enter.mockClear()
		await act(async () => {
			joined.selectSpace(rowId)
			await settle()
		})
		view.rerender(inputOf())
	}
	return { roster, user, switchTo }
}

afterEach(() => {
	cleanup()
})

describe("switching between a local and a joined space both carrying the id personal", () => {
	it("reloads the roster from the joined host with its own last bot", async () => {
		const { roster, user, switchTo } = await gearFor()

		await switchTo(HOST_PERSONAL_ROW)

		expect(roster.load).toHaveBeenCalledWith({
			spaceIds: ["personal"],
			spaceId: "personal",
			lastRowId: "host-bot",
		})
		expect(roster.enter).toHaveBeenCalledWith({
			spaceId: "personal",
			lastRowId: "host-bot",
		})
		expect(user.setLastSpace).toHaveBeenLastCalledWith(HOST_PERSONAL_ROW)
	})

	it("reloads the roster from the local store with its own last bot on the way back", async () => {
		const { roster, user, switchTo } = await gearFor()
		await switchTo(HOST_PERSONAL_ROW)

		await switchTo("personal")

		expect(roster.load).toHaveBeenCalledWith({
			spaceIds: ["personal"],
			spaceId: "personal",
			lastRowId: "local-bot",
		})
		expect(roster.enter).toHaveBeenCalledWith({
			spaceId: "personal",
			lastRowId: "local-bot",
		})
		expect(user.setLastSpace).toHaveBeenLastCalledWith("personal")
	})
})
