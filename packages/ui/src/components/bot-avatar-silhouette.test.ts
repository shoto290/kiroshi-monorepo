import { describe, expect, it } from "vitest"

import {
	affineTransform,
	applySurfaceAffine,
	conicAffine,
	type EarPlate,
	earSplitPath,
	type HeadVolume,
	IDENTITY_AFFINE,
	IDENTITY_QUAT,
	inPlaneSpin,
	ORIGIN,
	projectConic,
	type Quat,
	quatFromEuler,
	rotatedZ,
	rotateVec3,
	type SurfaceAffine,
	toRadians,
	type Vec2,
} from "@workspace/ui/components/bot-avatar-3d"
import {
	ANIMALS,
	type BotAvatarAnimal,
	type BotAvatarAnimalDefinition,
	type BotAvatarEar,
} from "@workspace/ui/components/bot-avatar-animals"
import {
	type BotAvatarSilhouette,
	botAvatarSilhouette,
	flattenPath,
	headSurfaceAffine,
	nearestOutlinePoint,
	outlineBounds,
	weldToSilhouette,
} from "@workspace/ui/components/bot-avatar-silhouette"

const ANIMAL_NAMES = Object.keys(ANIMALS) as BotAvatarAnimal[]
const SWEEP = [-60, -40, -20, -8, 0, 8, 20, 40, 60]
const WELD_TOLERANCE = 1e-9

const definitionOf = (name: BotAvatarAnimal) =>
	ANIMALS[name] as BotAvatarAnimalDefinition

const warpedOutline = (
	surface: BotAvatarSilhouette,
	affine: SurfaceAffine,
): Vec2[] => {
	const [cx, cy] = surface.center
	return surface.outline.map((point) => {
		const warped = applySurfaceAffine(affine, [point[0] - cx, point[1] - cy])
		return [cx + warped[0], cy + warped[1]]
	})
}

const controlPoints = (d: string): Vec2[] => {
	const values = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
	const points: Vec2[] = []
	for (let at = 0; at + 1 < values.length; at += 2) {
		points.push([values[at], values[at + 1]])
	}
	return points
}

const drawnEarPoints = (ear: BotAvatarEar): Vec2[] =>
	ear.shapes.flatMap((shape): Vec2[] => {
		if (shape.kind === "path") return flattenPath(shape.d)
		const rx = shape.kind === "circle" ? shape.r : shape.rx
		const ry = shape.kind === "circle" ? shape.r : shape.ry
		return [
			[shape.cx - rx, shape.cy - ry],
			[shape.cx + rx, shape.cy + ry],
		]
	})

const distanceToOutline = (outline: Vec2[], target: Vec2) => {
	const nearest = nearestOutlinePoint({ points: outline, target })
	return Math.hypot(target[0] - nearest[0], target[1] - nearest[1])
}

type WeldCase = {
	animal: BotAvatarAnimal
	yaw: number
	pitch: number
	roll: number
	perspective: number
}

const weldGap = ({ animal, yaw, pitch, roll, perspective }: WeldCase) => {
	const definition = definitionOf(animal)
	const surface = botAvatarSilhouette(definition)
	const rotation = quatFromEuler({
		yaw: toRadians(yaw),
		pitch: toRadians(pitch),
		roll: toRadians(roll),
	})
	const affine = headSurfaceAffine({ surface, rotation, perspective })
	const outline = warpedOutline(surface, affine)
	return surface.attachments.map((attach) =>
		distanceToOutline(outline, weldToSilhouette({ surface, attach, affine })),
	)
}

describe("path flattening", () => {
	it("samples every animal head into a closed polygon", () => {
		for (const name of ANIMAL_NAMES) {
			const points = flattenPath(definitionOf(name).head)
			expect(points.length).toBeGreaterThan(64)
			expect(Math.hypot(...points[0])).toBeGreaterThan(0)
		}
	})

	it("stays inside the control polygon of a single curve", () => {
		const points = flattenPath("M0,0 C0,100 100,100 100,0")
		for (const [x, y] of points) {
			expect(x).toBeGreaterThanOrEqual(-1e-9)
			expect(x).toBeLessThanOrEqual(100 + 1e-9)
			expect(y).toBeGreaterThanOrEqual(-1e-9)
			expect(y).toBeLessThanOrEqual(100 + 1e-9)
		}
	})
})

describe("head volume fit", () => {
	it("touches the drawn outline on all four sides", () => {
		for (const name of ANIMAL_NAMES) {
			const surface = botAvatarSilhouette(definitionOf(name))
			const { center, extent } = outlineBounds(surface.outline)
			expect(center[0]).toBeCloseTo(surface.center[0], 9)
			expect(center[1]).toBeCloseTo(surface.center[1], 9)
			expect(surface.radii[0]).toBeCloseTo(extent[0], 9)
			expect(surface.radii[1]).toBeCloseTo(extent[1], 9)
		}
	})

	it("never lets the drawn outline escape the fitted volume", () => {
		for (const name of ANIMAL_NAMES) {
			const surface = botAvatarSilhouette(definitionOf(name))
			for (const [x, y] of surface.outline) {
				expect(Math.abs(x - surface.center[0])).toBeLessThanOrEqual(
					surface.radii[0] + 1e-9,
				)
				expect(Math.abs(y - surface.center[1])).toBeLessThanOrEqual(
					surface.radii[1] + 1e-9,
				)
			}
		}
	})

	it("never exceeds the control-point bound, and beats it where the curve bends inside its hull", () => {
		let tighterAnimals = 0
		for (const name of ANIMAL_NAMES) {
			const animal = definitionOf(name)
			const surface = botAvatarSilhouette(animal)
			const hull = outlineBounds(controlPoints(animal.head))
			expect(surface.radii[0]).toBeLessThanOrEqual(hull.extent[0] + 1e-9)
			expect(surface.radii[1]).toBeLessThanOrEqual(hull.extent[1] + 1e-9)
			if (
				surface.radii[0] < hull.extent[0] - 1e-9 ||
				surface.radii[1] < hull.extent[1] - 1e-9
			) {
				tighterAnimals += 1
			}
		}
		expect(tighterAnimals).toBeGreaterThan(0)
	})
})

describe("ear attachment", () => {
	it("resolves every ear anchor onto the drawn head outline at rest", () => {
		for (const name of ANIMAL_NAMES) {
			const surface = botAvatarSilhouette(definitionOf(name))
			for (const attach of surface.attachments) {
				const point: Vec2 = [
					surface.center[0] + attach[0],
					surface.center[1] + attach[1],
				]
				expect(distanceToOutline(surface.outline, point)).toBeLessThan(1e-9)
			}
		}
	})

	it("welds the ear base to the rendered silhouette across a yaw sweep", () => {
		for (const animal of ANIMAL_NAMES) {
			for (const yaw of SWEEP) {
				for (const gap of weldGap({
					animal,
					yaw,
					pitch: 0,
					roll: 0,
					perspective: 0.55,
				})) {
					expect(gap).toBeLessThan(WELD_TOLERANCE)
				}
			}
		}
	})

	it("welds the ear base to the rendered silhouette across a pitch sweep", () => {
		for (const animal of ANIMAL_NAMES) {
			for (const pitch of SWEEP) {
				for (const gap of weldGap({
					animal,
					yaw: 0,
					pitch,
					roll: 0,
					perspective: 0.55,
				})) {
					expect(gap).toBeLessThan(WELD_TOLERANCE)
				}
			}
		}
	})

	it("holds the weld under combined roll and full perspective", () => {
		for (const animal of ANIMAL_NAMES) {
			for (const roll of SWEEP) {
				for (const gap of weldGap({
					animal,
					yaw: 37,
					pitch: -21,
					roll,
					perspective: 1,
				})) {
					expect(gap).toBeLessThan(WELD_TOLERANCE)
				}
			}
		}
	})

	it("emits a neutral ear warp at rest so the authored pose is untouched", () => {
		for (const animal of ANIMAL_NAMES) {
			const definition = definitionOf(animal)
			const surface = botAvatarSilhouette(definition)
			const affine = headSurfaceAffine({
				surface,
				rotation: IDENTITY_QUAT,
				perspective: 0,
			})
			surface.attachments.forEach((attach, index) => {
				const attachRest: Vec2 = [
					surface.center[0] + attach[0],
					surface.center[1] + attach[1],
				]
				const ear = definition.ears[index]
				const transform = affineTransform({
					affine: conicAffine({
						restRadii: [ear.volume.radii[0], ear.volume.radii[1]],
						current: projectConic({
							radii: ear.volume.radii,
							rotation: IDENTITY_QUAT,
							center: ORIGIN,
							perspective: 0,
						}),
						spin: inPlaneSpin(IDENTITY_QUAT),
					}),
					restPivot: attachRest,
					pivot: weldToSilhouette({ surface, attach, affine }),
				})
				expect(transform).toBe(
					affineTransform({
						affine: IDENTITY_AFFINE,
						restPivot: attachRest,
						pivot: attachRest,
					}),
				)
			})
		}
	})

	it("carries the anchor with the head through the same arc as the skull", () => {
		const surface = botAvatarSilhouette(ANIMALS.cat)
		const rotation = quatFromEuler({ yaw: toRadians(50), pitch: 0, roll: 0 })
		const affine = headSurfaceAffine({ surface, rotation, perspective: 0 })
		const attach = surface.attachments[0]
		const weld = weldToSilhouette({ surface, attach, affine })
		expect(affine.spin).toBeCloseTo(0, 9)
		expect(weld[1]).toBeCloseTo(surface.center[1] + attach[1], 9)
		expect(Math.abs(weld[0] - surface.center[0])).toBeLessThan(
			Math.abs(attach[0]),
		)
	})

	it("rolls the anchor with the head when the head rolls", () => {
		const surface = botAvatarSilhouette(ANIMALS.cat)
		const roll = toRadians(30)
		const affine = headSurfaceAffine({
			surface,
			rotation: quatFromEuler({ yaw: 0, pitch: 0, roll }),
			perspective: 0,
		})
		const attach = surface.attachments[0]
		const weld = weldToSilhouette({ surface, attach, affine })
		expect(affine.spin).toBeCloseTo(roll, 9)
		expect(weld[0] - surface.center[0]).toBeCloseTo(
			attach[0] * Math.cos(roll) - attach[1] * Math.sin(roll),
			6,
		)
	})
})

describe("ear volume authoring", () => {
	const EAR_VOLUME_TOLERANCE = 3

	it("keeps every authored ear volume on top of the shapes it is drawn from", () => {
		for (const name of ANIMAL_NAMES) {
			for (const ear of definitionOf(name).ears) {
				const drawn = outlineBounds(drawnEarPoints(ear))
				expect(Math.abs(ear.volume.center[0] - drawn.center[0])).toBeLessThan(
					EAR_VOLUME_TOLERANCE,
				)
				expect(Math.abs(ear.volume.center[1] - drawn.center[1])).toBeLessThan(
					EAR_VOLUME_TOLERANCE,
				)
				expect(Math.abs(ear.volume.radii[0] - drawn.extent[0])).toBeLessThan(
					EAR_VOLUME_TOLERANCE,
				)
				expect(Math.abs(ear.volume.radii[1] - drawn.extent[1])).toBeLessThan(
					EAR_VOLUME_TOLERANCE,
				)
			}
		}
	})
})

describe("ear depth split", () => {
	const SPLIT_PERSPECTIVE = 0.55
	const PITCH_SWEEP = [-40, -20, 0, 20, 40]
	const SURFACE_TOLERANCE = 1
	const PLATE_STEPS = 12
	const SWEEP_PLATE_STEPS = 5
	const EARS_ABOVE_THE_HEAD: BotAvatarAnimal[] = ["koala", "mouse", "owl"]

	type SplitCase = {
		animal: BotAvatarAnimal
		index: number
		yaw: number
		pitch: number
		perspective?: number
	}

	const splitCase = ({
		animal,
		index,
		yaw,
		pitch,
		perspective = SPLIT_PERSPECTIVE,
	}: SplitCase) => {
		const definition = definitionOf(animal)
		const surface = botAvatarSilhouette(definition)
		const ear = definition.ears[index]
		const rest = surface.earRests[index]
		const rotation = quatFromEuler({
			yaw: toRadians(yaw),
			pitch: toRadians(pitch),
			roll: 0,
		})
		const anchor = rotateVec3(rotation, rest.anchor)
		const placement = {
			affine: conicAffine({
				restRadii: [ear.volume.radii[0], ear.volume.radii[1]],
				current: projectConic({
					radii: ear.volume.radii,
					rotation,
					center: anchor,
					perspective,
				}),
				spin: inPlaneSpin(rotation),
			}),
			restPivot: rest.attachRest,
			pivot: weldToSilhouette({
				surface,
				attach: rest.attach,
				affine: headSurfaceAffine({ surface, rotation, perspective }),
			}),
		}
		const head: HeadVolume = {
			radii: surface.radii,
			rotation,
			center: surface.center,
		}
		const plate: EarPlate = {
			rotation,
			depth: anchor[2],
			center: ear.volume.center,
			squash: 1,
			placement,
		}
		return { ear, head, plate, path: earSplitPath({ head, plate }) }
	}

	const headNearDepth = ({ radii, rotation, center }: HeadVolume, at: Vec2) => {
		const inverse: Quat = [
			rotation[0],
			-rotation[1],
			-rotation[2],
			-rotation[3],
		]
		const base = rotateVec3(inverse, [at[0] - center[0], at[1] - center[1], 0])
		const ray = rotateVec3(inverse, [0, 0, 1])
		let a = 0
		let b = 0
		let c = -1
		for (let axis = 0; axis < 3; axis += 1) {
			const weight = 1 / (radii[axis] * radii[axis])
			a += ray[axis] * ray[axis] * weight
			b += base[axis] * ray[axis] * weight
			c += base[axis] * base[axis] * weight
		}
		const discriminant = b * b - a * c
		return discriminant < 0 ? null : (-b + Math.sqrt(discriminant)) / a
	}

	const plateDepthAt = (plate: EarPlate, at: Vec2) => {
		const { affine, restPivot, pivot } = plate.placement
		const unspun = applySurfaceAffine({ spin: -affine.spin, sx: 1, sy: 1 }, [
			at[0] - pivot[0],
			at[1] - pivot[1],
		])
		const authored: Vec2 = [
			restPivot[0] + unspun[0] / affine.sx,
			restPivot[1] + unspun[1] / affine.sy,
		]
		return (
			plate.depth +
			rotatedZ(plate.rotation, [
				authored[0] - plate.center[0],
				(authored[1] - plate.center[1]) * plate.squash,
				0,
			])
		)
	}

	const plateSamples = (
		ear: BotAvatarEar,
		plate: EarPlate,
		steps = PLATE_STEPS,
	): Vec2[] => {
		const { affine, restPivot, pivot } = plate.placement
		const samples: Vec2[] = []
		for (let row = -steps; row <= steps; row += 1) {
			for (let column = -steps; column <= steps; column += 1) {
				if (row * row + column * column > steps * steps) continue
				const authored: Vec2 = [
					ear.volume.center[0] + (ear.volume.radii[0] * column) / steps,
					ear.volume.center[1] + (ear.volume.radii[1] * row) / steps,
				]
				const placed = applySurfaceAffine(affine, [
					authored[0] - restPivot[0],
					authored[1] - restPivot[1],
				])
				samples.push([pivot[0] + placed[0], pivot[1] + placed[1]])
			}
		}
		return samples
	}

	const clipLoops = (path: string) =>
		path.split("M").filter(Boolean).map(controlPoints)

	const insideClip = (loops: Vec2[][], [x, y]: Vec2) => {
		let inside = false
		for (const points of loops) {
			for (let index = 0; index < points.length; index += 1) {
				const [ax, ay] = points[index]
				const [bx, by] = points[(index + 1) % points.length]
				if (ay > y === by > y) continue
				if (x < ax + ((y - ay) * (bx - ax)) / (by - ay)) inside = !inside
			}
		}
		return inside
	}

	const nearClipEdge = (loops: Vec2[][], point: Vec2) =>
		loops.some((points) => distanceToOutline(points, point) < SURFACE_TOLERANCE)

	const everyEar = (run: (animal: BotAvatarAnimal, index: number) => void) => {
		for (const animal of ANIMAL_NAMES) {
			definitionOf(animal).ears.forEach((_, index) => {
				run(animal, index)
			})
		}
	}

	const nearAndFar = (animal: BotAvatarAnimal, yaw: number) => {
		const cases = definitionOf(animal).ears.map((_, index) =>
			splitCase({ animal, index, yaw, pitch: 0 }),
		)
		const byDepth = [...cases].sort((a, b) => b.plate.depth - a.plate.depth)
		return { near: byDepth[0], far: byDepth.length > 1 ? byDepth.at(-1) : null }
	}

	const coveredOverHead = ({
		ear,
		head,
		plate,
		path,
	}: ReturnType<typeof splitCase>) => {
		const loops = clipLoops(path)
		return plateSamples(ear, plate).filter(
			(point) =>
				headNearDepth(head, point) !== null && insideClip(loops, point),
		)
	}

	it("keeps the whole ear plate behind the head when facing forward", () => {
		everyEar((animal, index) => {
			for (const perspective of [0, SPLIT_PERSPECTIVE]) {
				expect(
					splitCase({ animal, index, yaw: 0, pitch: 0, perspective }).path,
				).toBe("")
			}
		})
	})

	it("brings part of the near ear plate in front once the head turns", () => {
		for (const yaw of [40, 55, -40, -55]) {
			const { near } = nearAndFar("rabbit", yaw)
			expect(coveredOverHead(near).length).toBeGreaterThan(0)
		}
	})

	it("lays every boundary point inside the head on the head near surface", () => {
		everyEar((animal, index) => {
			for (const yaw of SWEEP) {
				for (const pitch of PITCH_SWEEP) {
					const { head, plate, path } = splitCase({ animal, index, yaw, pitch })
					for (const point of controlPoints(path)) {
						const surfaceDepth = headNearDepth(head, point)
						if (surfaceDepth === null) continue
						expect(
							Math.abs(plateDepthAt(plate, point) - surfaceDepth),
						).toBeLessThan(SURFACE_TOLERANCE)
					}
				}
			}
		})
	})

	it("draws the plate where it is nearer than the head surface and hides it where it is farther", () => {
		everyEar((animal, index) => {
			for (const yaw of SWEEP) {
				for (const pitch of PITCH_SWEEP) {
					const { ear, head, plate, path } = splitCase({
						animal,
						index,
						yaw,
						pitch,
					})
					const loops = clipLoops(path)
					for (const point of plateSamples(ear, plate, SWEEP_PLATE_STEPS)) {
						const surfaceDepth = headNearDepth(head, point)
						if (surfaceDepth === null || nearClipEdge(loops, point)) continue
						const lead = plateDepthAt(plate, point) - surfaceDepth
						expect(insideClip(loops, point)).toBe(lead > 0)
					}
				}
			}
		})
	})

	it("draws the near ear over the head from 40 degrees of yaw", () => {
		for (const animal of ANIMAL_NAMES) {
			for (const yaw of [40, 60, -40, -60]) {
				const { near, far } = nearAndFar(animal, yaw)
				if (!far) continue
				const covered = coveredOverHead(near).length
				if (EARS_ABOVE_THE_HEAD.includes(animal)) expect(covered).toBe(0)
				else expect(covered).toBeGreaterThan(0)
			}
		}
	})

	it("keeps the far ear behind the head from 40 degrees of yaw", () => {
		for (const animal of ANIMAL_NAMES) {
			for (const yaw of [40, 60, -40, -60]) {
				const { far } = nearAndFar(animal, yaw)
				if (far) expect(coveredOverHead(far)).toEqual([])
			}
		}
	})

	it("writes the same path for the same pose with two decimals at most", () => {
		const first = splitCase({ animal: "rabbit", index: 0, yaw: 47, pitch: -13 })
		const second = splitCase({
			animal: "rabbit",
			index: 0,
			yaw: 47,
			pitch: -13,
		})
		expect(first.path).toBe(second.path)
		expect(first.path).not.toBe("")
		expect(first.path).not.toMatch(/\.\d{3}/)
	})

	it("writes an empty path when the ear plate or the head has no area", () => {
		const { head, plate } = splitCase({
			animal: "rabbit",
			index: 0,
			yaw: 50,
			pitch: 0,
		})
		const flatPlate: EarPlate = {
			...plate,
			placement: {
				...plate.placement,
				affine: { ...plate.placement.affine, sy: 0 },
			},
		}
		const flatHead: HeadVolume = {
			...head,
			radii: [head.radii[0], 0, head.radii[2]],
		}
		expect(earSplitPath({ head, plate: flatPlate })).toBe("")
		expect(earSplitPath({ head: flatHead, plate })).toBe("")
	})
})
