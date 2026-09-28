import { describe, expect, it } from "vitest"

import {
	hexagonCorners,
	honeycombGrid,
	squareGrid,
} from "@workspace/ui/components/field-grid"
import {
	isInsideRoundedHexagon,
	OUTER,
} from "@workspace/ui/components/kiroshi-hexagon"

const COLUMNS = 16
const CELL_SHARE = 0.9
const OUTLINE_SIDE = OUTER.halfWidth * 2
const DISTANCE_TOLERANCE = 1e-9

const honeycomb = honeycombGrid(COLUMNS, CELL_SHARE)

const isInsideOutline = ({ u, v }: { u: number; v: number }) =>
	isInsideRoundedHexagon(
		OUTER,
		(u - 0.5) * OUTLINE_SIDE,
		(v - 0.5) * OUTLINE_SIDE,
	)

describe("honeycomb grid", () => {
	it("keeps every drawn hexagon whole inside the outline", () => {
		for (const point of honeycomb.points)
			expect(
				hexagonCorners(point, honeycomb.radius * CELL_SHARE).every(
					isInsideOutline,
				),
			).toBe(true)
	})

	it("spaces every neighbour pair at one pitch", () => {
		const pitch = Math.sqrt(3) * honeycomb.radius
		for (const [index, spills] of honeycomb.ahead.entries())
			for (const { to } of spills) {
				const from = honeycomb.points[index]
				const next = honeycomb.points[to]
				expect(
					Math.abs(Math.hypot(next.u - from.u, next.v - from.v) - pitch),
				).toBeLessThan(DISTANCE_TOLERANCE)
			}
	})

	it("spills the dithering error only forward in scan order", () => {
		for (const [index, spills] of honeycomb.ahead.entries())
			for (const { to } of spills) expect(to).toBeGreaterThan(index)
	})

	it("offsets every other row by half a cell", () => {
		const halfRowPitch = (Math.sqrt(3) * honeycomb.radius) / 2
		const parities = honeycomb.points.map(({ u, v }) => {
			const column = Math.round((u - 0.5) * COLUMNS + (COLUMNS - 1) / 2)
			const row = Math.round((v - 0.5) / halfRowPitch)
			return Math.abs(column + row) % 2
		})
		expect(new Set(parities)).toEqual(new Set([0]))
	})
})

describe("square grid", () => {
	it("keeps the Floyd-Steinberg spill of the square screen", () => {
		const grid = squareGrid(COLUMNS)
		expect(grid.ahead[0]).toEqual([
			{ to: 1, share: 7 / 16 },
			{ to: COLUMNS, share: 5 / 16 },
			{ to: COLUMNS + 1, share: 1 / 16 },
		])
	})
})
