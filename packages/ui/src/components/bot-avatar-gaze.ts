import {
	clamp,
	type EulerAngles,
	toRadians,
} from "@workspace/ui/components/bot-avatar-3d"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"

export type BotAvatarGaze = { yaw: number; pitch: number }

export const GAZE_CENTRE: BotAvatarGaze = { yaw: 0, pitch: 0 }

export const GAZE_YAW_LIMIT = 14
export const GAZE_PITCH_DOWN_LIMIT = 9
export const GAZE_PITCH_UP_LIMIT = 6
export const GAZE_AMPLITUDE_FLOOR = 0.35
export const GAZE_DART_DURATION = 80
export const GAZE_HOLD_FLOOR = 420
export const GAZE_CENTRE_SHARE = 1 / 3
export const GAZE_HEAD_DELAY = 90
export const GAZE_HEAD_YAW_RATIO = 0.45
export const GAZE_HEAD_PITCH_RATIO = 0.3
export const GAZE_HEAD_YAW_LIMIT = 7
export const GAZE_HEAD_PITCH_LIMIT = 4
export const GAZE_HEAD_SPRING_FREQUENCY = 7
export const GAZE_HEAD_SPRING_DAMPING = 0.6
export const GAZE_BLINK_TRAVEL = 10
export const GAZE_BLINK_SHARE = 0.3
export const GAZE_BLINK_DELAY: [number, number] = [40, 80]
export const GAZE_RIG_UNITS_PER_DEGREE = 0.11
export const GAZE_RIG_UNITS_LIMIT = 1.2
export const GAZE_RIG_TILT_PER_DEGREE = 0.05

export const GAZE_AXES: (keyof BotAvatarGaze)[] = ["yaw", "pitch"]

export type BotAvatarGazeCadence = {
	interval: [number, number]
	amplitude: number
	yawLimit: number
	pitchScale: number
	looksDownOnly: boolean
	heldPitch: number | null
	returnsToCentre: boolean
}

const cadence = (
	interval: [number, number],
	amplitude: number,
	bias: Partial<BotAvatarGazeCadence> = {},
): BotAvatarGazeCadence => ({
	interval,
	amplitude,
	yawLimit: GAZE_YAW_LIMIT,
	pitchScale: 1,
	looksDownOnly: false,
	heldPitch: null,
	returnsToCentre: false,
	...bias,
})

export const GAZE_CADENCE: Partial<
	Record<BotAvatarState, BotAvatarGazeCadence>
> = {
	thinking: cadence([1400, 2600], 1),
	searching: cadence([700, 1400], 1, { pitchScale: 0.4 }),
	working: cadence([1600, 3000], 0.6, { looksDownOnly: true }),
	writing: cadence([1200, 2200], 0.45, { yawLimit: 6, heldPitch: 6 }),
	waiting: cadence([2600, 4800], 0.35, { returnsToCentre: true }),
}

export type BotAvatarRandom = () => number

const inRange = (range: [number, number], random: BotAvatarRandom) =>
	range[0] + random() * (range[1] - range[0])

export const clampGaze = (
	{ yaw, pitch }: BotAvatarGaze,
	yawLimit = GAZE_YAW_LIMIT,
): BotAvatarGaze => ({
	yaw: clamp(yaw, -yawLimit, yawLimit),
	pitch: clamp(pitch, -GAZE_PITCH_UP_LIMIT, GAZE_PITCH_DOWN_LIMIT),
})

export const isGazeCentred = ({ yaw, pitch }: BotAvatarGaze) =>
	yaw === 0 && pitch === 0

export const drawGazeTarget = (
	state: BotAvatarGazeCadence,
	random: BotAvatarRandom,
): BotAvatarGaze => {
	if (random() < GAZE_CENTRE_SHARE) return { ...GAZE_CENTRE }
	const theta = random() * Math.PI * 2
	const amplitude = inRange([GAZE_AMPLITUDE_FLOOR, 1], random) * state.amplitude
	const sine = Math.sin(theta)
	const vertical = state.looksDownOnly ? Math.abs(sine) : sine
	const pitchLimit = vertical < 0 ? GAZE_PITCH_UP_LIMIT : GAZE_PITCH_DOWN_LIMIT
	return clampGaze(
		{
			yaw: amplitude * GAZE_YAW_LIMIT * Math.cos(theta),
			pitch:
				state.heldPitch ?? amplitude * pitchLimit * vertical * state.pitchScale,
		},
		state.yawLimit,
	)
}

export const glanceDelay = (
	state: BotAvatarGazeCadence,
	random: BotAvatarRandom,
) => Math.max(GAZE_HOLD_FLOOR, inRange(state.interval, random))

export const gazeAlong = (
	from: BotAvatarGaze,
	to: BotAvatarGaze,
	elapsed: number,
): BotAvatarGaze => {
	const travelled = clamp(elapsed / GAZE_DART_DURATION, 0, 1)
	return {
		yaw: from.yaw + (to.yaw - from.yaw) * travelled,
		pitch: from.pitch + (to.pitch - from.pitch) * travelled,
	}
}

export const headGazeFor = ({ yaw, pitch }: BotAvatarGaze): BotAvatarGaze => ({
	yaw: clamp(
		yaw * GAZE_HEAD_YAW_RATIO,
		-GAZE_HEAD_YAW_LIMIT,
		GAZE_HEAD_YAW_LIMIT,
	),
	pitch: clamp(
		pitch * GAZE_HEAD_PITCH_RATIO,
		-GAZE_HEAD_PITCH_LIMIT,
		GAZE_HEAD_PITCH_LIMIT,
	),
})

export const headGazeAsPose = ({ yaw, pitch }: BotAvatarGaze): EulerAngles => ({
	yaw: toRadians(yaw),
	pitch: toRadians(-pitch),
	roll: 0,
})

export const gazeTravel = (from: BotAvatarGaze, to: BotAvatarGaze) =>
	Math.hypot(to.yaw - from.yaw, to.pitch - from.pitch)

export const blinksWithDart = (travel: number, random: BotAvatarRandom) =>
	travel > GAZE_BLINK_TRAVEL && random() < GAZE_BLINK_SHARE

export const blinkDelay = (random: BotAvatarRandom) =>
	inRange(GAZE_BLINK_DELAY, random)

export const rigFromHeadGaze = (headYaw: number) => ({
	translation: clamp(
		headYaw * GAZE_RIG_UNITS_PER_DEGREE,
		-GAZE_RIG_UNITS_LIMIT,
		GAZE_RIG_UNITS_LIMIT,
	),
	tilt: headYaw * GAZE_RIG_TILT_PER_DEGREE,
})
