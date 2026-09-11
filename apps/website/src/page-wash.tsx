import { GrainGradient } from "@paper-design/shaders-react"

import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

import { useScrollProgress } from "./use-scroll-progress"

const WASH_COLORS = ["#BCAFE3", "#92C9C2", "#FBC600"]
const WASH_COLOR_BACK = "#00000000"
const WASH_SPEED = 0.73
const STILL_FRAME_SPEED = 0
const WASH_OFFSET_Y = 0.25
const WASH_PARALLAX = 0.3

export const PageWash = () => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const scrollProgress = useScrollProgress(!prefersReducedMotion)

	return (
		<GrainGradient
			aria-hidden="true"
			className="pointer-events-none fixed inset-x-0 top-0 h-dvh dark:brightness-27 dark:saturate-350"
			colorBack={WASH_COLOR_BACK}
			colors={WASH_COLORS}
			intensity={0.66}
			noise={0.54}
			offsetX={-1}
			offsetY={WASH_OFFSET_Y - WASH_PARALLAX * scrollProgress}
			rotation={0}
			scale={1.67}
			shape="wave"
			softness={1}
			speed={prefersReducedMotion ? STILL_FRAME_SPEED : WASH_SPEED}
		/>
	)
}
