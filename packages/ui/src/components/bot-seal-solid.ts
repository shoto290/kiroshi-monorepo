import { hashSeed } from "@workspace/ui/components/bot-avatar-blot"

type SealVertex = { x: number; y: number; arm: number; seal: number }

type SealSolid = {
	arms: number
	depth: number
	tilt: number
	profile: SealVertex[]
}

const TAU = Math.PI * 2
const MIN_ARMS = 4
const MAX_ARMS = 7
const REACH_RANGE = [0.66, 1] as const
const NOTCH_RANGE = [0.34, 0.52] as const
const GAP_RANGE = [0.38, 0.62] as const
const TIP_RANGE = [0.05, 0.2] as const
const DEPTH_RANGE = [0.45, 1] as const
const TILT_RANGE = [-TAU / 22, TAU / 22] as const
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

type Polar = { angle: number; radius: number; arm: number; seal: number }

const polar = ({ angle, radius, arm, seal }: Polar): SealVertex => ({
	x: Math.cos(angle) * radius,
	y: Math.sin(angle) * radius,
	arm,
	seal,
})

const sealProfile = (draw: Draw, arms: number): SealVertex[] => {
	const sector = TAU / arms
	const shapes = Array.from({ length: arms }, () => ({
		reach: between(draw, REACH_RANGE),
		tip: between(draw, TIP_RANGE) * sector,
		notch: between(draw, NOTCH_RANGE),
		gap: between(draw, GAP_RANGE) * sector,
	}))
	return shapes.flatMap(({ reach, tip, notch, gap }, arm) => {
		const angle = sector * arm
		const beside = shapes[(arm + 1) % arms].reach
		return [
			polar({ angle: angle - tip, radius: reach, arm, seal: 1 }),
			polar({ angle: angle + tip, radius: reach, arm, seal: 1 }),
			polar({
				angle: angle + gap,
				radius: notch,
				arm,
				seal: (reach + beside) / 2 / notch,
			}),
		]
	})
}

const sealSolid = (seed: string): SealSolid => {
	const draw = stream(seed)
	const arms = MIN_ARMS + (draw() % (MAX_ARMS - MIN_ARMS + 1))
	return {
		arms,
		depth: between(draw, DEPTH_RANGE),
		tilt: between(draw, TILT_RANGE),
		profile: sealProfile(draw, arms),
	}
}

export { MAX_ARMS, MIN_ARMS, type SealSolid, type SealVertex, sealSolid }
