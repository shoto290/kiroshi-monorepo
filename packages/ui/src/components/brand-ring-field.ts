import {
	type DensityField,
	fieldLattice,
} from "@workspace/ui/components/dithered-field-avatar"

type RoundedHexagon = {
	halfWidth: number
	halfHeight: number
}

const REFERENCE_WIDTH = 401
const OUTER: RoundedHexagon = { halfWidth: 200.5, halfHeight: 181.5 }
const INNER: RoundedHexagon = { halfWidth: 134.5, halfHeight: 123.5 }
const MARGIN_CELLS = 1
const TAN_30 = Math.tan(Math.PI / 6)
const EDGE_NORMAL = { x: -Math.cos(Math.PI / 6), y: 0.5 }

const hexagonDistance = (x: number, y: number, apothem: number) => {
	let px = Math.abs(x)
	let py = Math.abs(y)
	const fold = 2 * Math.min(EDGE_NORMAL.x * px + EDGE_NORMAL.y * py, 0)
	px -= fold * EDGE_NORMAL.x
	py -= fold * EDGE_NORMAL.y
	const reach = apothem * TAN_30
	const dx = px - Math.min(Math.max(px, -reach), reach)
	const dy = py - apothem
	return Math.hypot(dx, dy) * Math.sign(dy)
}

const isInside = (
	{ halfWidth, halfHeight }: RoundedHexagon,
	x: number,
	y: number,
) => {
	const apothem = (halfWidth - halfHeight) / (1 / Math.cos(Math.PI / 6) - 1)
	const rounding = halfHeight - apothem
	return hexagonDistance(x, y, apothem) <= rounding
}

const brandRingField = (seed: number, cells: number): DensityField => {
	const scale = (REFERENCE_WIDTH * cells) / (cells - 2 * MARGIN_CELLS)
	const ring = Uint8Array.from({ length: cells * cells }, (_, index) => {
		const x = (((index % cells) + 0.5) / cells - 0.5) * scale
		const y = ((Math.floor(index / cells) + 0.5) / cells - 0.5) * scale
		return isInside(OUTER, x, y) && !isInside(INNER, x, y) ? 1 : 0
	})
	return {
		cells,
		silhouette: Float32Array.from(ring),
		lattice: fieldLattice(seed),
		mask: ring,
	}
}

export { brandRingField }
