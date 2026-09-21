// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { createFakeThreadRuntimes } from "./fake-thread-runtimes"
import type { Mission } from "./mission-contract"
import { aMission } from "./mission-fixtures"
import { AGENT_SILENCE_MS } from "./missions-model"
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

const ACTIVE_MISSION: Mission = { ...MISSION, lastActivityAt: NOW }

const AFTER_THE_SILENCE = NOW + AGENT_SILENCE_MS

const A_DAY_MS = 24 * 60 * 60 * 1000

const liveIn = (runtimes: MissionSpeakingRuntimes, missions: Mission[]) =>
	renderHook(({ now }) => useLiveMissions(runtimes, missions, now), {
		initialProps: { now: NOW },
	})

const liveAt = (
	runtimes: MissionSpeakingRuntimes,
	missions: Mission[],
	now: number,
) => renderHook(() => useLiveMissions(runtimes, missions, now))

afterEach(cleanup)

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

	it("holds a mission whose agent acted within the silence window", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [ACTIVE_MISSION])

		expect([...result.current]).toEqual(["m-1"])
	})

	it("drops the mission once its agent stayed silent past the window", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const { result, rerender } = liveIn(runtimes, [ACTIVE_MISSION])

		rerender({ now: AFTER_THE_SILENCE })

		expect([...result.current]).toEqual([])
	})

	it("drops a silent agent even when the mission reads it as running", () => {
		const { runtimes } = createFakeThreadRuntimes()

		const { result } = liveAt(
			runtimes,
			[{ ...ACTIVE_MISSION, isAgentRunning: true }],
			AFTER_THE_SILENCE,
		)

		expect([...result.current]).toEqual([])
	})

	it("holds a silent agent while its companion speaks on the thread", () => {
		const { runtimes, publishSpeakers } = createFakeThreadRuntimes()
		const { result } = liveAt(runtimes, [ACTIVE_MISSION], AFTER_THE_SILENCE)

		publishSpeakers("thread-1", ["bot-1"])

		expect([...result.current]).toEqual(["m-1"])
	})

	it("reads a mission with no activity as running from its agent alone", () => {
		const { runtimes } = createFakeThreadRuntimes()

		const { result } = liveAt(runtimes, [RUNNING_MISSION], NOW + A_DAY_MS)

		expect([...result.current]).toEqual(["m-1"])
	})

	it("reads a mission with no activity and no running agent as resting", () => {
		const { runtimes } = createFakeThreadRuntimes()
		const { result } = liveIn(runtimes, [MISSION])

		expect([...result.current]).toEqual([])
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
