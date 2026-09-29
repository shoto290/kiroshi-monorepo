import { describe, expect, it } from "vitest"

import type { AppSidebarBot } from "@workspace/ui/components/app-sidebar"

import { toRailSignals, toSpaceBadges, withBadges } from "./sidebar-badges"

import type { Bot } from "../bindings"
import type { MissionState } from "../missions/mission-contract"
import { aMission } from "../missions/mission-fixtures"
import { type MissionsByRow, missionsByRow } from "../missions/missions-model"

type ShownBadge = AppSidebarBot["badge"]

const rosterBot = (id: string) => ({ id, name: id })

const ATLAS = rosterBot("atlas")
const BEACON = rosterBot("beacon")

describe("withBadges", () => {
	it("gives a companion the badge held for it", () => {
		const [atlas] = withBadges([ATLAS], { atlas: "attention" })
		expect(atlas.badge).toBe("attention")
	})

	it("gives no badge to a companion carrying none", () => {
		const [atlas] = withBadges([ATLAS], { atlas: "none" })
		expect(atlas.badge).toBeUndefined()
	})

	it("gives no badge to a companion without a held badge", () => {
		const [atlas] = withBadges([ATLAS], {})
		expect(atlas.badge).toBeUndefined()
	})

	it("leaves the rest of the row untouched", () => {
		const [atlas] = withBadges([{ ...ATLAS, title: "Scout" }], {
			atlas: "done",
		})
		expect(atlas).toMatchObject({ id: "atlas", name: "atlas", title: "Scout" })
	})
})

describe("toSpaceBadges", () => {
	const rowsOf = (badges: ShownBadge[]) =>
		badges.map((badge, index) => ({ ...rosterBot(`row-${index}`), badge }))

	const spaceOf = (...badges: ShownBadge[]) => ({ home: rowsOf(badges) })

	it("takes the strongest badge among the companions of a space", () => {
		expect(toSpaceBadges(spaceOf("done", "attention", "failed"), {}).home).toBe(
			"attention",
		)
	})

	it("ranks failed above done", () => {
		expect(toSpaceBadges(spaceOf("done", "failed"), {}).home).toBe("failed")
	})

	it("ranks done above no badge", () => {
		expect(toSpaceBadges(spaceOf(undefined, "done"), {}).home).toBe("done")
	})

	it("gives no badge to a space where every companion carries none", () => {
		expect(toSpaceBadges(spaceOf(undefined, undefined), {})).toEqual({})
	})

	it("badges every space of the roster", () => {
		const badges = toSpaceBadges(
			{
				home: [{ ...ATLAS, badge: "done" }],
				elsewhere: [{ ...BEACON, badge: "attention" }],
			},
			{},
		)
		expect(badges).toEqual({ home: "done", elsewhere: "attention" })
	})

	it("takes the badge of a conversation when no companion carries one", () => {
		expect(toSpaceBadges(spaceOf(undefined), spaceOf("attention")).home).toBe(
			"attention",
		)
	})

	it("ranks a conversation badge against the companion badges of the space", () => {
		expect(toSpaceBadges(spaceOf("done"), spaceOf("failed")).home).toBe(
			"failed",
		)
		expect(toSpaceBadges(spaceOf("attention"), spaceOf("failed")).home).toBe(
			"attention",
		)
	})

	it("badges a space held by the conversations alone", () => {
		expect(toSpaceBadges({}, spaceOf("attention"))).toEqual({
			home: "attention",
		})
	})

	it("gives no badge to a space where neither companions nor conversations carry one", () => {
		expect(toSpaceBadges(spaceOf(undefined), spaceOf(undefined))).toEqual({})
	})
})

describe("toRailSignals", () => {
	const badged = (badges: ShownBadge[]) =>
		badges.map((badge, index) => ({ id: `room-${index}`, badge }))

	const missionsOf = (state: MissionState) =>
		missionsByRow([{ mission: aMission({ state }), bot: {} as Bot }], [])

	type RailSeed = {
		conversations?: Record<string, ReturnType<typeof badged>>
		missions?: Record<string, MissionsByRow>
		spaceId?: string | null
	}

	const signalsOf = ({
		conversations = {},
		missions = {},
		spaceId = "vocca",
	}: RailSeed) =>
		toRailSignals({
			conversationsBySpaceId: conversations,
			missionsBySpaceId: missions,
			spaceId,
		})

	it("counts the conversations of the space carrying a badge", () => {
		const { counts } = signalsOf({
			conversations: {
				vocca: badged(["attention", undefined, "done", "failed"]),
			},
		})
		expect(counts.conversations).toBe(3)
	})

	it("counts nothing when no conversation carries a badge", () => {
		const { counts } = signalsOf({
			conversations: { vocca: badged([undefined, undefined]) },
		})
		expect(counts.conversations).toBe(0)
	})

	it("dots Conversations while a conversation of the space asks for attention", () => {
		const asking = signalsOf({
			conversations: { vocca: badged(["done", "attention"]) },
		})
		const settled = signalsOf({
			conversations: { vocca: badged(["done", "failed"]) },
		})
		expect(asking.dots.conversations).toBe(true)
		expect(settled.dots.conversations).toBe(false)
	})

	it("dots Missions while a mission of the space waits on the reader", () => {
		const waiting = signalsOf({
			missions: { vocca: missionsOf("waiting_human") },
		})
		const working = signalsOf({ missions: { vocca: missionsOf("working") } })
		expect(waiting.dots.missions).toBe(true)
		expect(working.dots.missions).toBe(false)
	})

	it("reads the signals of the selected space only", () => {
		const sources = {
			conversations: { atlas: badged(["attention", "done"]) },
			missions: { atlas: missionsOf("waiting_human") },
		}
		const vocca = signalsOf({ ...sources, spaceId: "vocca" })
		const atlas = signalsOf({ ...sources, spaceId: "atlas" })
		expect(vocca).toEqual({
			counts: { conversations: 0 },
			dots: { conversations: false, missions: false },
		})
		expect(atlas).toEqual({
			counts: { conversations: 2 },
			dots: { conversations: true, missions: true },
		})
	})

	it("signals nothing on Companions and Applications", () => {
		const { counts, dots } = signalsOf({
			conversations: { vocca: badged(["attention"]) },
			missions: { vocca: missionsOf("waiting_human") },
		})
		expect(counts).not.toHaveProperty("companions")
		expect(counts).not.toHaveProperty("applications")
		expect(dots).not.toHaveProperty("companions")
		expect(dots).not.toHaveProperty("applications")
	})

	it("signals nothing when no space is selected", () => {
		const { counts, dots } = signalsOf({
			conversations: { vocca: badged(["attention"]) },
			spaceId: null,
		})
		expect(counts.conversations).toBe(0)
		expect(dots).toEqual({ conversations: false, missions: false })
	})
})
