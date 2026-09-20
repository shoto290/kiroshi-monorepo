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

const ANIMATED_STATES: BotSealState[] = [
	"thinking",
	"searching",
	"working",
	"writing",
]

const TAU = Math.PI * 2
const CENTER = VIEW_BOX / 2
const RADIUS = 92
const DEPTH_REACH = 12
const PERSPECTIVE = 0.35
const SEAL_PITCH = toRadians(11)
const BREAK_ANGLE = toRadians(24)
const BREAK_PUSH = 0.12
const NO_BROKEN_ARM = -1
const DEGENERATE_AREA = 1
const FLAT_LEVEL = 0
const BACK_LEVEL = -1
const FRONT_LEVEL = 1

const TURN_PERIOD = 2200
const OPEN_PERIOD = 4200
const PUMP_PERIOD = 2000
const WRITE_PERIOD = 11000
const WRITE_REST = 0.25

type Stop = [number, number]

const TURN_BEAT: Stop[] = [
	[0, 0],
	[0.12, -0.1],
	[0.62, 1.07],
	[0.76, 1],
	[1, 1],
]

const OPEN_BEAT: Stop[] = [
	[0, 1],
	[0.07, 1.12],
	[0.46, -0.08],
	[0.58, -0.08],
	[0.95, 1],
	[1, 1],
]

const PUMP_BEAT: Stop[] = [
	[0, 1],
	[0.16, 0.42],
	[0.52, 1.26],
	[0.68, 1],
	[1, 1],
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
	open: number
	pump: number
	armPhase: number
	isFlat: boolean
	isBroken: boolean
}

type MotionInput = { state?: BotSealState; elapsed: number; arms: number }

const sealMotion = ({ state, elapsed, arms }: MotionInput): SealMotion => ({
	spin: state === "thinking" ? turnOf(elapsed, arms) : 0,
	open:
		state === "searching" ? along(OPEN_BEAT, phaseOf(elapsed, OPEN_PERIOD)) : 1,
	pump:
		state === "working" ? along(PUMP_BEAT, phaseOf(elapsed, PUMP_PERIOD)) : 1,
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

const rotationOf = (solid: SealSolid, motion: SealMotion) =>
	quatFromEuler({
		yaw: solid.tilt * motion.open,
		pitch: SEAL_PITCH * motion.open,
		roll: motion.spin,
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
	level: number
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
		face.x * RADIUS,
		face.y * RADIUS,
		level * solid.depth * motion.pump * extruded * DEPTH_REACH,
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

const wallFacings = (back: Vec2[], front: Vec2[]): Facing[] =>
	back.map((point, at) =>
		facingOf(
			signedArea([
				point,
				back[(at + 1) % back.length],
				front[(at + 1) % front.length],
				front[at],
			]),
		),
	)

const solidSegments = (back: Vec2[], front: Vec2[]): Segment[] => {
	const count = back.length
	const walls = wallFacings(back, front)
	const under = fanFacings(back, -1)
	const over = fanFacings(front, 1)
	const segments: Segment[] = []
	for (let at = 0; at < count; at += 1) {
		const next = (at + 1) % count
		const shared = walls[(at + count - 1) % count]
		if (under[at] > 0 || walls[at] > 0) segments.push([back[at], back[next]])
		if (over[at] > 0 || walls[at] > 0) segments.push([front[at], front[next]])
		if (walls[at] > 0 || shared > 0) segments.push([back[at], front[at]])
	}
	return segments
}

const line = (from: Vec2, to: Vec2) =>
	`M${round2(from[0])} ${round2(from[1])}L${round2(to[0])} ${round2(to[1])}`

const pathOf = (segments: Segment[]) =>
	segments.map(([from, to]) => line(from, to)).join("")

type FrameInput = { solid: SealSolid; state?: BotSealState; elapsed: number }

const sealFrame = ({ solid, state, elapsed }: FrameInput) => {
	const motion = sealMotion({ state, elapsed, arms: solid.arms })
	const rotation = rotationOf(solid, motion)
	const brokenArm = motion.isBroken
		? nearestArm(solid, rotation)
		: NO_BROKEN_ARM
	const ring = (level: number) =>
		solid.profile.map((vertex) =>
			placeVertex({ solid, motion, rotation, brokenArm, vertex, level }),
		)
	return pathOf(
		motion.isFlat
			? loopSegments(ring(FLAT_LEVEL))
			: solidSegments(ring(BACK_LEVEL), ring(FRONT_LEVEL)),
	)
}

const isSealAnimated = (state?: BotSealState) =>
	state !== undefined && ANIMATED_STATES.includes(state)

export { BOT_SEAL_STATES, type BotSealState, isSealAnimated, sealFrame }
