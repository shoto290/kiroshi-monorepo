import { GrainGradient } from "@paper-design/shaders-react"

import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const WASH_COLORS = ["#BCAFE3", "#92C9C2", "#FBC600"]
const WASH_COLOR_BACK = "#00000000"
const WASH_SPEED = 0.73
const STILL_FRAME_SPEED = 0

export const PageWash = () => {
	const prefersReducedMotion = usePrefersReducedMotion()

	return (
		<GrainGradient
			aria-hidden="true"
			className="pointer-events-none fixed inset-x-0 top-0 h-dvh"
			colorBack={WASH_COLOR_BACK}
			colors={WASH_COLORS}
			intensity={0.66}
			noise={0.54}
			offsetX={-1}
			offsetY={0.25}
			rotation={0}
			scale={1.67}
			shape="wave"
			softness={1}
			speed={prefersReducedMotion ? STILL_FRAME_SPEED : WASH_SPEED}
		/>
	)
}
