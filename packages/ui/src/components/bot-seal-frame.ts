import {
	clamp,
	project,
	type Quat,
	quatFromEuler,
	rotatedZ,
	rotateVec3,
	round2,
	toRadians,
	type Vec2,
	type Vec3,
	VIEW_BOX,
} from "@workspace/ui/components/bot-avatar-3d"
import type {
	SealLevel,
	SealSolid,
	SealVertex,
} from "@workspace/ui/components/bot-seal-solid"

const BOT_SEAL_STATES = [
	"thinking",
	"searching",
	"working",
	"writing",
	"waiting",
	"blocked",
	"done",
] as const

type BotSealState = (typeof BOT_SEAL_STATES)[number]

type SealFrame = { lit: string; dim: string }

const ANIMATED_STATES: BotSealState[] = [
	"thinking",
	"searching",
	"working",
	"writing",
]

const TAU = Math.PI * 2
const CENTER = VIEW_BOX / 2
const RADIUS = 88
const DEPTH_REACH = 46
const PERSPECTIVE = 0.5
const SEAL_PITCH = toRadians(26)
const REST_CUT = 0
const BREAK_ANGLE = toRadians(46)
const BREAK_PUSH = 0.14
const NO_BROKEN_ARM = -1
const DEGENERATE_AREA = 1
const CUT_MARGIN = 6
const FLAT_LEVELS: SealLevel[] = [{ z: 0, scale: 1 }]

const TURN_PERIOD = 2200
const SWEEP_PERIOD = 4200
const PUMP_PERIOD = 2000
const WRITE_PERIOD = 11000
const SWEEP_REST = 0.235
const WRITE_REST = 0.25

type Stop = [number, number]

const TURN_BEAT: Stop[] = [
	[0, 0],
	[0.12, -0.1],
	[0.62, 1.07],
	[0.76, 1],
	[1, 1],
]

const PUMP_BEAT: Stop[] = [
	[0, 1],
	[0.16, 0.42],
	[0.52, 1.26],
	[0.68, 1],
	[1, 1],
]

const CUT_BEAT: Stop[] = [
	[0, -1],
	[0.05, -1.12],
	[0.42, 1],
	[0.55, 1],
	[0.6, 1.12],
	[0.95, -1],
	[1, -1],
]

const WRITE_BEAT: Stop[] = [
	[0, 0],
	[0.05, -0.08],
	[0.42, 1],
	[0.55, 1],
	[0.6, 1.06],
	[0.95, 0],
	[1, 0],
]

const SETTLE_BEAT: Stop[] = [
	[0, 0],
	[0.62, 1.14],
	[1, 1],
]

const easeInOut = (t: number) => t * t * (3 - 2 * t)

const along = (stops: Stop[], phase: number) => {
	for (let at = 1; at < stops.length; at += 1) {
		const [from, held] = stops[at - 1]
		const [until, target] = stops[at]
		if (phase > until) continue
		return held + (target - held) * easeInOut((phase - from) / (until - from))
	}
	return stops[stops.length - 1][1]
}

const phaseOf = (elapsed: number, period: number) => (elapsed % period) / period

const turnOf = (elapsed: number, arms: number) =>
	((TAU / arms) *
		(Math.floor(elapsed / TURN_PERIOD) +
			along(TURN_BEAT, phaseOf(elapsed, TURN_PERIOD)))) %
	TAU

type SealMotion = {
	spin: number
	pump: number
	cut: number
	armPhase: number
	isFlat: boolean
	isBroken: boolean
}

type MotionInput = { state?: BotSealState; elapsed: number; arms: number }

const sealMotion = ({ state, elapsed, arms }: MotionInput): SealMotion => ({
	spin: state === "thinking" ? turnOf(elapsed, arms) : 0,
	pump:
		state === "working" ? along(PUMP_BEAT, phaseOf(elapsed, PUMP_PERIOD)) : 1,
	cut:
		state === "searching"
			? along(
					CUT_BEAT,
					phaseOf(elapsed + SWEEP_REST * SWEEP_PERIOD, SWEEP_PERIOD),
				)
			: REST_CUT,
	armPhase:
		state === "writing"
			? arms *
				along(
					WRITE_BEAT,
					phaseOf(elapsed + WRITE_REST * WRITE_PERIOD, WRITE_PERIOD),
				)
			: arms,
	isFlat: state === "done",
	isBroken: state === "blocked",
})

const armTip = ({ arms }: SealSolid, arm: number): Vec3 => [
	Math.cos((TAU * arm) / arms) * RADIUS,
	Math.sin((TAU * arm) / arms) * RADIUS,
	0,
]

const nearestArm = (solid: SealSolid, rotation: Quat) => {
	const depths = Array.from({ length: solid.arms }, (_, arm) =>
		rotatedZ(rotation, armTip(solid, arm)),
	)
	return depths.indexOf(Math.max(...depths))
}

type Break = { vertex: SealVertex; arms: number }

const brokenAway = ({ vertex: { x, y, arm }, arms }: Break) => {
	const angle = (TAU * arm) / arms
	return {
		x:
			x * Math.cos(BREAK_ANGLE) -
			y * Math.sin(BREAK_ANGLE) +
			Math.cos(angle) * BREAK_PUSH,
		y:
			x * Math.sin(BREAK_ANGLE) +
			y * Math.cos(BREAK_ANGLE) +
			Math.sin(angle) * BREAK_PUSH,
	}
}

type Placement = {
	solid: SealSolid
	motion: SealMotion
	rotation: Quat
	brokenArm: number
	vertex: SealVertex
	level: SealLevel
}

const placeVertex = ({
	solid,
	motion,
	rotation,
	brokenArm,
	vertex,
	level,
}: Placement): Vec2 => {
	const extruded = along(SETTLE_BEAT, clamp(motion.armPhase - vertex.arm, 0, 1))
	const face =
		vertex.arm === brokenArm ? brokenAway({ vertex, arms: solid.arms }) : vertex
	const point: Vec3 = [
		face.x * level.scale * RADIUS,
		face.y * level.scale * RADIUS,
		level.z * solid.depth * motion.pump * extruded * DEPTH_REACH,
	]
	const [x, y] = project({
		point: rotateVec3(rotation, point),
		perspective: PERSPECTIVE,
	})
	return [CENTER + x, CENTER + y]
}

type Segment = [Vec2, Vec2]

type Facing = -1 | 0 | 1

const signedArea = (points: Vec2[]) =>
	points.reduce((area, [x, y], at) => {
		const [nextX, nextY] = points[(at + 1) % points.length]
		return area + x * nextY - nextX * y
	}, 0)

const facingOf = (area: number): Facing => {
	if (Math.abs(area) < DEGENERATE_AREA) return 0
	return area > 0 ? 1 : -1
}

const loopSegments = (ring: Vec2[]): Segment[] =>
	ring.map((point, at): Segment => [point, ring[(at + 1) % ring.length]])

const centreOf = (ring: Vec2[]): Vec2 => [
	ring.reduce((total, [x]) => total + x, 0) / ring.length,
	ring.reduce((total, [, y]) => total + y, 0) / ring.length,
]

const fanFacings = (ring: Vec2[], outward: number): Facing[] => {
	const centre = centreOf(ring)
	return ring.map((point, at) =>
		facingOf(
			outward * signedArea([centre, point, ring[(at + 1) % ring.length]]),
		),
	)
}

const stackSegments = (rings: Vec2[][]): Segment[] => {
	const ring = rings[0]
	if (rings.length === 1) return loopSegments(ring)
	const count = ring.length
	const walls = rings
		.slice(1)
		.map((upper, band) =>
			Array.from({ length: count }, (_, at) =>
				facingOf(
					signedArea([
						rings[band][at],
						rings[band][(at + 1) % count],
						upper[(at + 1) % count],
						upper[at],
					]),
				),
			),
		)
	const under = fanFacings(ring, -1)
	const over = fanFacings(rings[rings.length - 1], 1)
	const below = (level: number, at: number) =>
		level === 0 ? under[at] : walls[level - 1][at]
	const above = (level: number, at: number) =>
		level === rings.length - 1 ? over[at] : walls[level][at]
	const segments: Segment[] = []
	rings.forEach((level, index) => {
		for (let at = 0; at < count; at += 1) {
			if (below(index, at) > 0 || above(index, at) > 0) {
				segments.push([level[at], level[(at + 1) % count]])
			}
		}
	})
	walls.forEach((wall, band) => {
		for (let at = 0; at < count; at += 1) {
			if (wall[at] > 0 || wall[(at + count - 1) % count] > 0) {
				segments.push([rings[band][at], rings[band + 1][at]])
			}
		}
	})
	return segments
}

const cutLineOf = (segments: Segment[], cut: number) => {
	let top = Number.POSITIVE_INFINITY
	let bottom = Number.NEGATIVE_INFINITY
	for (const [from, to] of segments) {
		top = Math.min(top, from[1], to[1])
		bottom = Math.max(bottom, from[1], to[1])
	}
	return top - CUT_MARGIN + ((cut + 1) / 2) * (bottom - top + 2 * CUT_MARGIN)
}

const line = (from: Vec2, to: Vec2) =>
	`M${round2(from[0])} ${round2(from[1])}L${round2(to[0])} ${round2(to[1])}`

const splitAtCut = (segments: Segment[], cutY: number): SealFrame => {
	const lit: string[] = []
	const dim: string[] = []
	for (const [from, to] of segments) {
		const isFromLit = from[1] <= cutY
		const isToLit = to[1] <= cutY
		if (isFromLit === isToLit) {
			;(isFromLit ? lit : dim).push(line(from, to))
			continue
		}
		const ratio = (cutY - from[1]) / (to[1] - from[1])
		const crossing: Vec2 = [from[0] + (to[0] - from[0]) * ratio, cutY]
		;(isFromLit ? lit : dim).push(line(from, crossing))
		;(isToLit ? lit : dim).push(line(crossing, to))
	}
	return { lit: lit.join(""), dim: dim.join("") }
}

type FrameInput = { solid: SealSolid; state?: BotSealState; elapsed: number }

const sealFrame = ({ solid, state, elapsed }: FrameInput): SealFrame => {
	const motion = sealMotion({ state, elapsed, arms: solid.arms })
	const rotation = quatFromEuler({
		yaw: solid.tilt + motion.spin,
		pitch: SEAL_PITCH,
		roll: 0,
	})
	const brokenArm = motion.isBroken
		? nearestArm(solid, rotation)
		: NO_BROKEN_ARM
	const segments = solid.stacks.flatMap((stack) =>
		stackSegments(
			(motion.isFlat ? FLAT_LEVELS : stack.levels).map((level) =>
				stack.profile.map((vertex) =>
					placeVertex({ solid, motion, rotation, brokenArm, vertex, level }),
				),
			),
		),
	)
	return splitAtCut(segments, cutLineOf(segments, motion.cut))
}

const isSealAnimated = (state?: BotSealState) =>
	state !== undefined && ANIMATED_STATES.includes(state)

export {
	BOT_SEAL_STATES,
	type BotSealState,
	isSealAnimated,
	type SealFrame,
	sealFrame,
}
