"use client"

import { useRef } from "react"

import {
	companionSeed,
	type ExplorationAvatarProps,
	type ExplorationState,
	fieldIntensity,
	pickSilhouette,
	type Silhouette,
	stillTime,
	toField,
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

type OrbitSystem = { coreRadius: number; orbits: Orbit[] }

const VIEW = 100
const MIDDLE = VIEW / 2
const TURN = Math.PI * 2
const DEGREE = Math.PI / 180
const REVOLUTION = 5000
const TILT_STEPS = 8
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

const ORBIT_SPACE = { families: LAYOUTS.length, variants: 192 }

const orbitSystem = ({ family, variant }: Silhouette): OrbitSystem => {
	const layout = LAYOUTS[family]
	const tilt = (variant % TILT_STEPS) * (layout.spread / TILT_STEPS) * DEGREE
	const satellites = 3 + (Math.floor(variant / TILT_STEPS) % 4)
	const flattening = FLATTENINGS[Math.floor(variant / 32) % FLATTENINGS.length]
	const coreRadius = CORE_RADII[Math.floor(variant / 96) % CORE_RADII.length]
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
	return { coreRadius, orbits: [...rings, ...moon] }
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
						<ellipse
							cx={MIDDLE}
							cy={MIDDLE}
							fill="none"
							opacity={0.4}
							rx={orbit.rx}
							ry={orbit.ry}
							stroke="currentColor"
							strokeWidth={2.5}
							transform={`rotate(${orbit.tilt / DEGREE} ${MIDDLE} ${MIDDLE})`}
						/>
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

export { ORBIT_SPACE, OrbitAvatar, orbitSystem }
