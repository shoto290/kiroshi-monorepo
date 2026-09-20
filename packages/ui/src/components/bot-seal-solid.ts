import { hashSeed } from "@workspace/ui/components/bot-avatar-blot"

const SEAL_FAMILIES = ["asterisk", "cross", "gem", "ring", "plates"] as const

type SealFamily = (typeof SEAL_FAMILIES)[number]
type SealSymmetry = "radial" | "mirrored"

type SealShape = {
	family: SealFamily
	arms: number
	profile: number
	depth: number
	tilt: number
	symmetry: SealSymmetry
	shortArm: number
}

type SealVertex = { x: number; y: number; arm: number }
type SealLevel = { z: number; scale: number }
type SealStack = { profile: SealVertex[]; levels: SealLevel[] }
type SealSolid = SealShape & { stacks: SealStack[] }

const TAU = Math.PI * 2
const MIN_ARMS = 3
const MAX_ARMS = 8
const PROFILE_RANGE = [0.3, 0.8] as const
const DEPTH_RANGE = [0.35, 0.95] as const
const TILT_RANGE = [-TAU / 6, TAU / 6] as const
const HUB_RANGE = [0.16, 0.42] as const
const BAR_RANGE = [0.08, 0.2] as const
const RING_RANGE = [0.36, 0.66] as const
const PLATE_TAPER_RANGE = [0.1, 0.22] as const
const SHORT_ARM_REACH = 0.6
const MIRRORED_REACH = 0.78
const GEM_TIP_SCALE = 0.32
const PLATE_LEVELS = 4
const UINT32 = 4294967296

const stream = (seed: string) => {
	let state = hashSeed(seed)
	return () => {
		state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0
		state = (state ^ (state >>> 13)) >>> 0
		return state
	}
}

type Draw = () => number

const between = (draw: Draw, [min, max]: readonly [number, number]) =>
	min + (draw() / UINT32) * (max - min)

const sealShape = (seed: string): SealShape => {
	const draw = stream(seed)
	const family = SEAL_FAMILIES[draw() % SEAL_FAMILIES.length]
	const arms = MIN_ARMS + (draw() % (MAX_ARMS - MIN_ARMS + 1))
	return {
		family,
		arms,
		profile: between(draw, PROFILE_RANGE),
		depth: between(draw, DEPTH_RANGE),
		tilt: between(draw, TILT_RANGE),
		symmetry: draw() % 2 === 0 ? "radial" : "mirrored",
		shortArm: draw() % arms,
	}
}

const armAngle = (arms: number, arm: number) => (TAU * arm) / arms

const armReach = ({ symmetry, shortArm }: SealShape, arm: number) => {
	if (arm === shortArm) return SHORT_ARM_REACH
	if (symmetry === "mirrored" && arm % 2 === 1) return MIRRORED_REACH
	return 1
}

const polar = (angle: number, radius: number, arm: number): SealVertex => ({
	x: Math.cos(angle) * radius,
	y: Math.sin(angle) * radius,
	arm,
})

const shaped = (
	{ profile }: SealShape,
	[min, max]: readonly [number, number],
) => min + profile * (max - min)

const asteriskProfile = (solid: SealShape) => {
	const hub = shaped(solid, HUB_RANGE)
	return Array.from({ length: solid.arms }, (_, arm) => {
		const angle = armAngle(solid.arms, arm)
		return [
			polar(angle, armReach(solid, arm), arm),
			polar(angle + Math.PI / solid.arms, hub, arm),
		]
	}).flat()
}

const crossProfile = (solid: SealShape) => {
	const hub = shaped(solid, HUB_RANGE)
	const half = shaped(solid, BAR_RANGE)
	return Array.from({ length: solid.arms }, (_, arm) => {
		const angle = armAngle(solid.arms, arm)
		const reach = armReach(solid, arm)
		const along = { x: Math.cos(angle), y: Math.sin(angle) }
		const across = { x: -along.y, y: along.x }
		const corner = (distance: number, offset: number): SealVertex => ({
			x: along.x * distance + across.x * offset,
			y: along.y * distance + across.y * offset,
			arm,
		})
		return [
			corner(hub, -half),
			corner(reach, -half),
			corner(reach, half),
			corner(hub, half),
		]
	}).flat()
}

const polygonProfile = (solid: SealShape, scale = 1) =>
	Array.from({ length: solid.arms }, (_, arm) =>
		polar(armAngle(solid.arms, arm), armReach(solid, arm) * scale, arm),
	)

const EXTRUDED_LEVELS: SealLevel[] = [
	{ z: -1, scale: 1 },
	{ z: 1, scale: 1 },
]

const GEM_LEVELS: SealLevel[] = [
	{ z: -1, scale: GEM_TIP_SCALE },
	{ z: 0, scale: 1 },
	{ z: 1, scale: GEM_TIP_SCALE },
]

const plateLevels = (solid: SealShape): SealLevel[] => {
	const taper = shaped(solid, PLATE_TAPER_RANGE)
	return Array.from({ length: PLATE_LEVELS }, (_, index) => ({
		z: -1 + (2 * index) / (PLATE_LEVELS - 1),
		scale: 1 - index * taper,
	}))
}

const STACKS: Record<SealFamily, (solid: SealShape) => SealStack[]> = {
	asterisk: (solid) => [
		{ profile: asteriskProfile(solid), levels: EXTRUDED_LEVELS },
	],
	cross: (solid) => [{ profile: crossProfile(solid), levels: EXTRUDED_LEVELS }],
	gem: (solid) => [{ profile: polygonProfile(solid), levels: GEM_LEVELS }],
	ring: (solid) => [
		{ profile: polygonProfile(solid), levels: EXTRUDED_LEVELS },
		{
			profile: polygonProfile(solid, shaped(solid, RING_RANGE)),
			levels: EXTRUDED_LEVELS,
		},
	],
	plates: (solid) => [
		{ profile: polygonProfile(solid), levels: plateLevels(solid) },
	],
}

const sealSolid = (seed: string): SealSolid => {
	const shape = sealShape(seed)
	return { ...shape, stacks: STACKS[shape.family](shape) }
}

export {
	MAX_ARMS,
	MIN_ARMS,
	SEAL_FAMILIES,
	type SealLevel,
	type SealSolid,
	type SealVertex,
	sealSolid,
}
