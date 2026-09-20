// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { forgetMissionRuns } from "./agent-run-stamps"
import { createFakeThreadRuntimes } from "./fake-thread-runtimes"
import type { Mission } from "./mission-contract"
import { aMission } from "./mission-fixtures"
import { AGENT_LIVENESS_WINDOW_MS } from "./missions-model"
import {
	type MissionSpeakingRuntimes,
	useLiveMissions,
} from "./use-live-missions"

const NOW = Date.parse("2026-03-04T14:20:00")

const MISSION = aMission({
	id: "m-1",
	botId: "bot-1",
	threadConversationId: "thread-1",
})

const RUNNING_MISSION: Mission = { ...MISSION, isAgentRunning: true }

const AFTER_THE_WINDOW = NOW + AGENT_LIVENESS_WINDOW_MS

const liveIn = (runtimes: MissionSpeakingRuntimes, missions: Mission[]) =>
	renderHook(({ now }) => useLiveMissions(runtimes, missions, now), {
		initialProps: { now: NOW },
	})

const liveAt = (
	runtimes: MissionSpeakingRuntimes,
	missions: Mission[],
	now: number,
) => renderHook(() => useLiveMissions(runtimes, missions, now))

afterEach(() => {
	cleanup()
	forgetMissionRuns()
})

describe("useLiveMissions", () => {
	it("holds a mission whose companion speaks on its thread", () => {
		const { runtimes, publishSpeakers } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [MISSION])

		publishSpeakers("thread-1", ["bot-1"])

		expect([...result.current]).toEqual(["m-1"])
	})

	it("drops the mission once its companion stops speaking", () => {
		const { runtimes, publishSpeakers } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [MISSION])
		publishSpeakers("thread-1", ["bot-1"])

		publishSpeakers("thread-1", [])

		expect([...result.current]).toEqual([])
	})

	it("holds nothing when another companion speaks on the thread", () => {
		const { runtimes, publishSpeakers } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [MISSION])

		publishSpeakers("thread-1", ["bot-2"])

		expect([...result.current]).toEqual([])
	})

	it("holds a mission whose agent reads as running", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [RUNNING_MISSION])

		expect([...result.current]).toEqual(["m-1"])
	})

	it("drops the running agent once the window it was stamped in ran out", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const { result, rerender } = liveIn(runtimes, [RUNNING_MISSION])

		rerender({ now: AFTER_THE_WINDOW })

		expect([...result.current]).toEqual([])
	})

	it("reads a mission stamped before the window as resting on a later mount", () => {
		const { runtimes } = createFakeThreadRuntimes()
		liveIn(runtimes, [RUNNING_MISSION]).unmount()

		const { result } = liveAt(runtimes, [RUNNING_MISSION], AFTER_THE_WINDOW)

		expect([...result.current]).toEqual([])
	})

	it("answers two mounted readers from the same stamps", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const first = liveIn(runtimes, [RUNNING_MISSION])

		const second = liveAt(runtimes, [RUNNING_MISSION], AFTER_THE_WINDOW)

		expect([...first.result.current]).toEqual(["m-1"])
		expect([...second.result.current]).toEqual([])
	})

	it("stamps a mission again once its agent stopped and started back", () => {
		const { runtimes } = createFakeThreadRuntimes()
		liveIn(runtimes, [RUNNING_MISSION]).unmount()
		liveIn(runtimes, [MISSION]).unmount()

		const { result } = liveAt(runtimes, [RUNNING_MISSION], AFTER_THE_WINDOW)

		expect([...result.current]).toEqual(["m-1"])
	})

	it("holds the same set while nothing moves", () => {
		const { runtimes, publishSpeakers } = createFakeThreadRuntimes()
		const missions = [MISSION]
		const { result, rerender } = liveIn(runtimes, missions)
		publishSpeakers("thread-1", ["bot-1"])
		const held = result.current

		rerender({ now: NOW })

		expect(result.current).toBe(held)
	})
})
