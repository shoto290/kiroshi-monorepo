// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BLANK_BOT_PERMISSIONS } from "@workspace/ui/components/bot-settings"

import type { MissionChanged, MissionOnBoard } from "./mission-contract"
import { aMission } from "./mission-fixtures"
import { missionsTransport } from "./missions-transport"
import { useMissionBoard } from "./use-mission-board"

import type { Bot } from "@/lib/conversations/store-contract"

vi.mock("./missions-transport", () => ({
	missionsTransport: {
		board: vi.fn(),
		onChanged: vi.fn(),
	},
}))

const readBoard = vi.mocked(missionsTransport.board)
const listenToMissions = vi.mocked(missionsTransport.onChanged)

const BOT: Bot = {
	id: "bot-1",
	name: "Atlas",
	title: "",
	model: "sonnet",
	avatarAnimal: "owl",
	avatarBlot: "blue",
	avatarImagePath: null,
	workingDir: null,
	instructions: "",
	deniedTools: [],
	permissions: BLANK_BOT_PERMISSIONS,
	outputStyle: "",
	createdAt: 1,
	changesNothing: false,
	memory: "",
	sectionId: null,
	pinPosition: null,
}

const onBoard = (id: string): MissionOnBoard => ({
	mission: aMission({ id }),
	bot: BOT,
})

const FIRST_BOARD = [onBoard("m-1")]
const NEXT_BOARD = [onBoard("m-1"), onBoard("m-2")]

const A_CHANGE: MissionChanged = { missionId: "m-2", state: "working" }

describe("useMissionBoard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readBoard.mockResolvedValue(FIRST_BOARD)
		listenToMissions.mockResolvedValue(() => undefined)
	})

	afterEach(cleanup)

	it("reads the board once the roster starts listening", async () => {
		const { result } = renderHook(() => useMissionBoard())

		await waitFor(() => expect(result.current).toEqual(FIRST_BOARD))
	})

	it("re-reads the board when a mission change reaches the app", async () => {
		const { result } = renderHook(() => useMissionBoard())
		await waitFor(() => expect(result.current).toEqual(FIRST_BOARD))

		readBoard.mockResolvedValue(NEXT_BOARD)
		const [announce] = listenToMissions.mock.calls[0]
		announce(A_CHANGE)

		await waitFor(() => expect(result.current).toEqual(NEXT_BOARD))
	})

	it("stops listening for mission changes when the roster stops reading", async () => {
		const stopListening = vi.fn()
		listenToMissions.mockResolvedValue(stopListening)
		const { unmount } = renderHook(() => useMissionBoard())
		await waitFor(() => expect(listenToMissions).toHaveBeenCalled())

		unmount()

		await waitFor(() => expect(stopListening).toHaveBeenCalled())
	})

	it("empties the board when it cannot be read", async () => {
		readBoard.mockRejectedValue(new Error("no board"))

		const { result } = renderHook(() => useMissionBoard())

		await waitFor(() => expect(readBoard).toHaveBeenCalled())
		expect(result.current).toEqual([])
	})
})
