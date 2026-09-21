import { GrainGradient } from "@paper-design/shaders-react"
import { useMemo, useSyncExternalStore } from "react"

import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

import { useScrollProgress } from "./use-scroll-progress"

const LIGHT_WASH_TOKENS = [
	"--color-wash-lilac",
	"--color-wash-teal",
	"--color-wash-gold",
]
const DARK_WASH_TOKENS = [
	"--color-wash-dark-lilac",
	"--color-wash-dark-teal",
	"--color-wash-dark-gold",
]
const WASH_BACK_TOKEN = "--color-wash-back"
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const WASH_SPEED = 0.73
const STILL_FRAME_SPEED = 0
const WASH_OFFSET_Y = 0.25
const WASH_PARALLAX = 0.3

const subscribeToScheme = (onChange: () => void) => {
	const query = window.matchMedia(DARK_SCHEME_QUERY)
	query.addEventListener("change", onChange)
	return () => query.removeEventListener("change", onChange)
}

const isDarkScheme = () => document.documentElement.classList.contains("dark")

const readToken = (styles: CSSStyleDeclaration, token: string) =>
	styles.getPropertyValue(token).trim()

const readWashPalette = (isDark: boolean) => {
	const styles = window.getComputedStyle(document.documentElement)
	const tokens = isDark ? DARK_WASH_TOKENS : LIGHT_WASH_TOKENS

	return {
		back: readToken(styles, WASH_BACK_TOKEN),
		colors: tokens.map((token) => readToken(styles, token)),
	}
}

export const PageWash = () => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const scrollProgress = useScrollProgress(!prefersReducedMotion)
	const isDark = useSyncExternalStore(subscribeToScheme, isDarkScheme)
	const palette = useMemo(() => readWashPalette(isDark), [isDark])

	return (
		<GrainGradient
			aria-hidden="true"
			className="pointer-events-none fixed inset-x-0 top-0 h-dvh"
			colorBack={palette.back}
			colors={palette.colors}
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
