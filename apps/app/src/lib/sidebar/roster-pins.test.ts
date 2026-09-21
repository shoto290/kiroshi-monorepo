import { describe, expect, it } from "vitest"

import {
	filedInSection,
	isPinnedRow,
	pinnedLast,
	pinsOf,
	withoutPin,
} from "./roster-pins"

const SECTIONS = [
	{ id: "section-build", position: 0 },
	{ id: "section-review", position: 2 },
]

const ROWS = [
	{ id: "room-standup", pinPosition: 1, sectionId: null },
	{ id: "bot-scribe", pinPosition: 0, sectionId: "section-build" },
	{ id: "bot-atlas", pinPosition: null, sectionId: null },
	{ id: "bot-echo", pinPosition: 1, sectionId: "section-review" },
	{ id: "bot-nomad", pinPosition: 3, sectionId: "gone" },
]

const pins = () => pinsOf({ rows: ROWS, sections: SECTIONS })

const idsOf = (held: { id: string }[]) => held.map((entry) => entry.id)

describe("pinsOf", () => {
	it("lays the pinned rows out under the section that holds them", () => {
		expect(pins()).toEqual([
			{ id: "section-build", sectionId: null },
			{ id: "bot-scribe", sectionId: "section-build" },
			{ id: "room-standup", sectionId: null },
			{ id: "section-review", sectionId: null },
			{ id: "bot-echo", sectionId: "section-review" },
			{ id: "bot-nomad", sectionId: null },
		])
	})

	it("leaves the unpinned rows out", () => {
		expect(idsOf(pins())).not.toContain("bot-atlas")
	})
})

describe("isPinnedRow", () => {
	it("reads a row without a pin position as unpinned", () => {
		expect(isPinnedRow({ id: "bot-atlas", pinPosition: null })).toBe(false)
		expect(isPinnedRow({ id: "bot-scribe", pinPosition: 0 })).toBe(true)
	})
})

describe("pinnedLast", () => {
	it("adds the companion at the end of the pins", () => {
		expect(idsOf(pinnedLast(pins(), "bot-atlas")).at(-1)).toBe("bot-atlas")
	})
})

describe("withoutPin", () => {
	it("drops the companion from the pins", () => {
		expect(idsOf(withoutPin(pins(), "bot-scribe"))).not.toContain("bot-scribe")
	})
})

describe("filedInSection", () => {
	it("files the companion at the end of the named section", () => {
		expect(
			idsOf(filedInSection(pins(), "bot-atlas", "section-build") ?? []),
		).toEqual([
			"section-build",
			"bot-scribe",
			"bot-atlas",
			"room-standup",
			"section-review",
			"bot-echo",
			"bot-nomad",
		])
	})

	it("files nothing into a section the roster does not hold", () => {
		expect(filedInSection(pins(), "bot-atlas", "gone")).toBeNull()
	})
})
