import {
	clamp,
	project,
	type Quat,
	quatFromEuler,
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
const DEPTH_REACH = 50
const PERSPECTIVE = 0.5
const SEAL_PITCH = toRadians(26)
const SPIN_PERIOD = 9000
const SWEEP_PERIOD = 5200
const PUMP_PERIOD = 1600
const WRITE_PERIOD = 5600
const PUMP_FLOOR = 0.3
const REST_CUT = 0
const BREAK_ANGLE = toRadians(46)
const BREAK_PUSH = 0.14
const FLAT_LEVELS: SealLevel[] = [{ z: 0, scale: 1 }]

type SealMotion = {
	spin: number
	pump: number
	cut: number
	armPhase: number
	isFlat: boolean
	isBroken: boolean
}

type MotionInput = { state?: BotSealState; elapsed: number; arms: number }

const phaseOf = (elapsed: number, period: number) => (elapsed % period) / period

const midPhaseOf = (elapsed: number, period: number) =>
	phaseOf(elapsed + period / 2, period)

const sweepOf = (elapsed: number, period: number) => {
	const phase = phaseOf(elapsed + period / 4, period)
	return phase < 0.5 ? phase * 2 : 2 - phase * 2
}

const sealMotion = ({ state, elapsed, arms }: MotionInput): SealMotion => ({
	spin: state === "thinking" ? TAU * phaseOf(elapsed, SPIN_PERIOD) : 0,
	pump:
		state === "working"
			? PUMP_FLOOR +
				(1 - PUMP_FLOOR) *
					(0.5 - 0.5 * Math.cos(TAU * midPhaseOf(elapsed, PUMP_PERIOD)))
			: 1,
	cut:
		state === "searching" ? -1 + 2 * sweepOf(elapsed, SWEEP_PERIOD) : REST_CUT,
	armPhase: state === "writing" ? arms * sweepOf(elapsed, WRITE_PERIOD) : arms,
	isFlat: state === "done",
	isBroken: state === "blocked",
})

type Break = { vertex: SealVertex; arms: number }

const brokenArm = ({ arms, shortArm }: SealSolid) => (shortArm + 1) % arms

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
	vertex: SealVertex
	level: SealLevel
}

const placeVertex = ({
	solid,
	motion,
	rotation,
	vertex,
	level,
}: Placement): Vec2 => {
	const extruded = clamp(motion.armPhase - vertex.arm, 0, 1)
	const face =
		motion.isBroken && vertex.arm === brokenArm(solid)
			? brokenAway({ vertex, arms: solid.arms })
			: vertex
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

const ringSegments = (rings: Vec2[][]): Segment[] => {
	const segments: Segment[] = []
	for (const ring of rings) {
		for (let index = 0; index < ring.length; index += 1) {
			segments.push([ring[index], ring[(index + 1) % ring.length]])
		}
	}
	for (let level = 1; level < rings.length; level += 1) {
		for (let index = 0; index < rings[level].length; index += 1) {
			segments.push([rings[level - 1][index], rings[level][index]])
		}
	}
	return segments
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
	const segments = solid.stacks.flatMap((stack) =>
		ringSegments(
			(motion.isFlat ? FLAT_LEVELS : stack.levels).map((level) =>
				stack.profile.map((vertex) =>
					placeVertex({ solid, motion, rotation, vertex, level }),
				),
			),
		),
	)
	return splitAtCut(segments, CENTER + motion.cut * CENTER)
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
