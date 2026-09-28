import {
	type Silhouette,
	silhouetteRandom,
} from "@workspace/ui/components/companion-field"

type Symmetry = (column: number, row: number) => [number, number]

type SilhouetteCell = { column: number; row: number; x: number; y: number }

const COLUMNS = 5
const ROWS = 7
const FILL_CHANCE = 0.55
const MIN_CELLS = 12
const SPINE = (COLUMNS - 1) / 2

const SYMMETRIES: Symmetry[] = [
	(column, row) => [Math.min(column, COLUMNS - 1 - column), row],
	(column, row) =>
		column === SPINE ? [-1, 0] : [Math.min(column, COLUMNS - 1 - column), row],
	(column, row) => [
		Math.min(column, COLUMNS - 1 - column),
		Math.min(row, ROWS - 1 - row),
	],
	(column, row) =>
		row * COLUMNS + column <= (ROWS * COLUMNS - 1) / 2
			? [column, row]
			: [COLUMNS - 1 - column, ROWS - 1 - row],
]

const COMPANION_SILHOUETTE_SPACE = {
	families: SYMMETRIES.length,
	variants: 1024,
}

const silhouetteCells = (silhouette: Silhouette): SilhouetteCell[] => {
	const symmetry = SYMMETRIES[silhouette.family]
	const random = silhouetteRandom(silhouette)
	const lit = new Map<string, boolean>()
	const isLit = (column: number, row: number) => {
		const key = symmetry(column, row).join(",")
		if (!lit.has(key)) lit.set(key, key === "-1,0" || random() < FILL_CHANCE)
		return lit.get(key) === true
	}

	const isSparse =
		Array.from({ length: ROWS * COLUMNS }).filter((_, index) =>
			isLit(index % COLUMNS, Math.floor(index / COLUMNS)),
		).length < MIN_CELLS

	const cells: SilhouetteCell[] = []
	for (let row = 0; row < ROWS; row++)
		for (let column = 0; column < COLUMNS; column++)
			if (isLit(column, row) || (isSparse && column === SPINE))
				cells.push({
					column,
					row,
					x: (column / (COLUMNS - 1)) * 2 - 1,
					y: (row / (ROWS - 1)) * 2 - 1,
				})
	return cells
}

const silhouetteKey = (silhouette: Silhouette) =>
	silhouetteCells(silhouette)
		.map(({ column, row }) => `${column},${row}`)
		.join(" ")

export { COMPANION_SILHOUETTE_SPACE, silhouetteCells, silhouetteKey }
