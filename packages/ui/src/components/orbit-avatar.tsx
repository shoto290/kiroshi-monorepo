"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	stepCount,
	stillTime,
	toField,
	variantSteps,
} from "@workspace/ui/components/avatar-exploration"
import {
	ExplorationFrame,
	useExplorationClock,
} from "@workspace/ui/components/avatar-exploration-frame"

type Orbit = {
	rx: number
	ry: number
	tilt: number
	satellites: number
	satelliteRadius: number
	direction: 1 | -1
}

type OrbitLayout = { rings: number; spread: number; moon: boolean }

type SatellitePlacement = { orbit: Orbit; index: number; time: number }

type OrbitSystem = { coreRadius: number; hasTrails: boolean; orbits: Orbit[] }

const VIEW = 100
const MIDDLE = VIEW / 2
const TURN = Math.PI * 2
const DEGREE = Math.PI / 180
const REVOLUTION = 5000
const TILT_STEP = 45
const TILTS = 4
const SATELLITE_COUNTS = [3, 4, 5, 6]
const FLATTENINGS = [0.28, 0.44, 0.6]
const CORE_RADII = [8, 13]
const SATELLITE_RADIUS = 4.6
const MOON_RADIUS = 7.5

const LAYOUTS: OrbitLayout[] = [
	{ rings: 1, spread: 180, moon: false },
	{ rings: 2, spread: 90, moon: false },
	{ rings: 3, spread: 60, moon: false },
	{ rings: 1, spread: 180, moon: true },
	{ rings: 2, spread: 180, moon: false },
]

const ORBIT_STEPS = [
	TILTS,
	SATELLITE_COUNTS.length,
	FLATTENINGS.length,
	CORE_RADII.length,
	2,
] as const

const ORBIT_SPACE = {
	families: LAYOUTS.length,
	variants: stepCount(ORBIT_STEPS),
}

const readableTilt = (family: number, tiltStep: number) => {
	const { spread } = LAYOUTS[family]
	return spread < TILT_STEP * 2 ? 0 : (tiltStep * TILT_STEP) % spread
}

const orbitKey = ({ family, variant }: Silhouette) => {
	const [tiltStep, ...rest] = variantSteps(variant, ORBIT_STEPS)
	return [family, readableTilt(family, tiltStep), ...rest].join(".")
}

const orbitSystem = ({ family, variant }: Silhouette): OrbitSystem => {
	const layout = LAYOUTS[family]
	const [tiltStep, satelliteStep, flatteningStep, coreStep, trailStep] =
		variantSteps(variant, ORBIT_STEPS)
	const tilt = readableTilt(family, tiltStep) * DEGREE
	const satellites = SATELLITE_COUNTS[satelliteStep]
	const flattening = FLATTENINGS[flatteningStep]
	const coreRadius = CORE_RADII[coreStep]
	const isConcentric = family === 4

	const rings = Array.from({ length: layout.rings }, (_, ring): Orbit => {
		const rx = isConcentric ? 24 + ring * 16 : 38
		return {
			rx,
			ry: rx * flattening,
			tilt: isConcentric ? tilt : tilt + (ring * Math.PI) / layout.rings,
			satellites: isConcentric ? satellites - ring : satellites,
			satelliteRadius: SATELLITE_RADIUS,
			direction: ring % 2 === 0 ? 1 : -1,
		}
	})
	const moon: Orbit[] = layout.moon
		? [
				{
					rx: 42,
					ry: 42 * flattening,
					tilt: tilt + Math.PI / 2,
					satellites: 1,
					satelliteRadius: MOON_RADIUS,
					direction: -1,
				},
			]
		: []
	return {
		coreRadius,
		hasTrails: trailStep === 1,
		orbits: [...rings, ...moon],
	}
}

const satellitePosition = ({ orbit, index, time }: SatellitePlacement) => {
	const angle =
		(index / orbit.satellites) * TURN +
		orbit.direction * (time / REVOLUTION) * TURN
	const ex = orbit.rx * Math.cos(angle)
	const ey = orbit.ry * Math.sin(angle)
	return {
		cx: MIDDLE + ex * Math.cos(orbit.tilt) - ey * Math.sin(orbit.tilt),
		cy: MIDDLE + ex * Math.sin(orbit.tilt) + ey * Math.cos(orbit.tilt),
	}
}

const satelliteOpacity = (
	state: ExplorationState,
	{ cx, cy }: ReturnType<typeof satellitePosition>,
	time: number,
) => fieldIntensity(state, { x: toField(cx, VIEW), y: toField(cy, VIEW) }, time)

const OrbitAvatar = ({
	name,
	tint,
	state = "idle",
	size = 40,
}: ExplorationAvatarProps) => {
	const root = useRef<SVGSVGElement>(null)
	const system = orbitSystem(
		pickSilhouette(companionSeed(name, tint), ORBIT_SPACE),
	)
	const still = stillTime(state)

	useExplorationClock({
		state,
		paint: (time) => {
			const travel = state === "idle" ? 0 : time
			const satellites =
				root.current?.querySelectorAll<SVGCircleElement>("[data-satellite]")
			for (const element of satellites ?? []) {
				const orbit = system.orbits[Number(element.dataset.orbit)]
				const index = Number(element.dataset.satellite)
				const position = satellitePosition({ orbit, index, time: travel })
				element.setAttribute("cx", String(position.cx))
				element.setAttribute("cy", String(position.cy))
				element.style.opacity = String(satelliteOpacity(state, position, time))
			}
		},
	})

	return (
		<ExplorationFrame name={name} size={size} state={state} tint={tint}>
			<svg
				aria-hidden="true"
				className="pointer-events-none size-full"
				ref={root}
				viewBox={`0 0 ${VIEW} ${VIEW}`}
			>
				{system.orbits.map((orbit, orbitIndex) => (
					<g key={`${orbit.rx}-${orbit.tilt}`}>
						{system.hasTrails && (
							<ellipse
								cx={MIDDLE}
								cy={MIDDLE}
								fill="none"
								opacity={0.55}
								rx={orbit.rx}
								ry={orbit.ry}
								stroke="currentColor"
								strokeWidth={3}
								transform={`rotate(${orbit.tilt / DEGREE} ${MIDDLE} ${MIDDLE})`}
							/>
						)}
						{Array.from({ length: orbit.satellites }, (_, index) => {
							const position = satellitePosition({
								orbit,
								index,
								time: state === "idle" ? 0 : still,
							})
							return (
								<circle
									{...position}
									data-orbit={orbitIndex}
									data-satellite={index}
									fill="currentColor"
									// biome-ignore lint/suspicious/noArrayIndexKey: satellites are positional and never reorder
									key={index}
									opacity={satelliteOpacity(state, position, still)}
									r={orbit.satelliteRadius}
								/>
							)
						})}
					</g>
				))}
				<circle
					cx={MIDDLE}
					cy={MIDDLE}
					fill="currentColor"
					r={system.coreRadius}
				/>
			</svg>
		</ExplorationFrame>
	)
}

export { ORBIT_SPACE, OrbitAvatar, orbitKey, orbitSystem }
