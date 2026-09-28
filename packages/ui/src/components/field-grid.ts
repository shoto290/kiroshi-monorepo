import {
	isInsideRoundedHexagon,
	OUTER,
} from "@workspace/ui/components/kiroshi-hexagon"

type CellShape = "square" | "hexagon"

type FieldPoint = { u: number; v: number }

type Spill = { to: number; share: number }

type FieldGrid = {
	shape: CellShape
	cells: number
	radius: number
	points: FieldPoint[]
	ahead: Spill[][]
}

type HoneycombCell = FieldPoint & { column: number; halfRow: number }

const SQUARE_SPILLS = [
	{ column: 1, row: 0, share: 7 / 16 },
	{ column: -1, row: 1, share: 3 / 16 },
	{ column: 0, row: 1, share: 5 / 16 },
	{ column: 1, row: 1, share: 1 / 16 },
]

const HONEYCOMB_SPILLS = [
	{ column: -1, halfRow: 1, share: 3 / 8 },
	{ column: 1, halfRow: 1, share: 3 / 8 },
	{ column: 0, halfRow: 2, share: 1 / 4 },
]

const SQRT_3 = Math.sqrt(3)
const HEXAGON_CORNERS = 6
const TURN = Math.PI / 3
const OUTLINE_SIDE = OUTER.halfWidth * 2

const squareGrid = (cells: number): FieldGrid => {
	const indexOf = (column: number, row: number) =>
		column >= 0 && column < cells && row < cells ? row * cells + column : -1
	return {
		shape: "square",
		cells,
		radius: 0.5 / cells,
		points: Array.from({ length: cells * cells }, (_, index) => ({
			u: ((index % cells) + 0.5) / cells,
			v: (Math.floor(index / cells) + 0.5) / cells,
		})),
		ahead: Array.from({ length: cells * cells }, (_, index) =>
			SQUARE_SPILLS.map(({ column, row, share }) => ({
				to: indexOf((index % cells) + column, Math.floor(index / cells) + row),
				share,
			})).filter(({ to }) => to >= 0),
		),
	}
}

const hexagonCorners = ({ u, v }: FieldPoint, radius: number) =>
	Array.from({ length: HEXAGON_CORNERS }, (_, corner) => ({
		u: u + radius * Math.cos(corner * TURN),
		v: v + radius * Math.sin(corner * TURN),
	}))

const isInsideOutline = ({ u, v }: FieldPoint) =>
	isInsideRoundedHexagon(
		OUTER,
		(u - 0.5) * OUTLINE_SIDE,
		(v - 0.5) * OUTLINE_SIDE,
	)

const honeycombGrid = (columns: number, cellShare: number): FieldGrid => {
	const pitch = 1 / columns
	const radius = pitch / 1.5
	const halfRowPitch = (SQRT_3 * radius) / 2
	const halfRows = Math.ceil(0.5 / halfRowPitch)
	const cells: HoneycombCell[] = []
	for (let halfRow = -halfRows; halfRow <= halfRows; halfRow++)
		for (let column = 0; column < columns; column++) {
			if ((column + halfRow) % 2 !== 0) continue
			const cell = {
				column,
				halfRow,
				u: 0.5 + (column - (columns - 1) / 2) * pitch,
				v: 0.5 + halfRow * halfRowPitch,
			}
			if (hexagonCorners(cell, radius * cellShare).every(isInsideOutline))
				cells.push(cell)
		}
	const keyOf = (column: number, halfRow: number) => `${column} ${halfRow}`
	const indexByKey = new Map(
		cells.map(({ column, halfRow }, index) => [keyOf(column, halfRow), index]),
	)
	return {
		shape: "hexagon",
		cells: columns,
		radius,
		points: cells.map(({ u, v }) => ({ u, v })),
		ahead: cells.map(({ column, halfRow }) =>
			HONEYCOMB_SPILLS.map((spill) => ({
				to:
					indexByKey.get(
						keyOf(column + spill.column, halfRow + spill.halfRow),
					) ?? -1,
				share: spill.share,
			})).filter(({ to }) => to >= 0),
		),
	}
}

export {
	type FieldGrid,
	type FieldPoint,
	hexagonCorners,
	honeycombGrid,
	squareGrid,
}
