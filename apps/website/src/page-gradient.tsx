import { GrainGradient } from "@paper-design/shaders-react"

import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const DESKTOP_GRADIENT = {
	scale: 1.67,
	colors: ["#BCAFE3", "#92C9C2", "#FBC600"],
}

const MOBILE_GRADIENT = {
	scale: 1.54,
	colors: ["#FDC800", "#92C9C2", "#BCAFE3"],
}

const TRANSPARENT_BACK = "#00000000"
const ANIMATED_SPEED = 0.73

export const PageGradient = () => {
	const isDesktop = useMediaQuery("(min-width: 48rem)")
	const prefersReducedMotion = usePrefersReducedMotion()
	const { scale, colors } = isDesktop ? DESKTOP_GRADIENT : MOBILE_GRADIENT

	return (
		<GrainGradient
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 size-full"
			colorBack={TRANSPARENT_BACK}
			colors={colors}
			intensity={0.66}
			noise={0.54}
			offsetX={-1}
			offsetY={0.25}
			rotation={0}
			scale={scale}
			shape="wave"
			softness={1}
			speed={prefersReducedMotion ? 0 : ANIMATED_SPEED}
		/>
	)
}
