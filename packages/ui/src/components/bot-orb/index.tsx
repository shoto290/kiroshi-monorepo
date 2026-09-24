"use client"

import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import {
	type OrbTint,
	paintFrame,
} from "@workspace/ui/components/bot-orb/engine/core"
import { MODE_FRAMES } from "@workspace/ui/components/bot-orb/engine/registry"
import { resolvePreset } from "@workspace/ui/components/bot-orb/presets"
import { useResolvedDark } from "@workspace/ui/components/bot-orb/theme"
import type { OrbState } from "@workspace/ui/components/bot-orb/types"
import { seededBlot } from "@workspace/ui/components/bot-tile"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"

const BOT_ORB_STATES = [
	"working",
	"searching",
	"solving",
	"listening",
	"connecting",
	"weaving",
	"composing",
	"breathing",
	"shaping",
] as const satisfies readonly OrbState[]

const BOT_ORB_SIZES = [64, 20] as const

type BotOrbSize = (typeof BOT_ORB_SIZES)[number]

const RESTING_STATE: OrbState = "working"
const STILL_FRAME_SECONDS = 0.6
const MAX_PIXEL_RATIO = 2

const orbTint = (blot: BotAvatarBlot) =>
	`color-mix(in oklab, ${blotTint(blot)}, var(--bot-blot-ink) var(--bot-orb-shade))`

const rgbOf = (color: string): OrbTint | undefined => {
	const probe = document.createElement("canvas")
	probe.width = 1
	probe.height = 1
	const context = probe.getContext("2d", { willReadFrequently: true })
	if (!context) return undefined
	context.fillStyle = color
	context.fillRect(0, 0, 1, 1)
	const [r, g, b] = context.getImageData(0, 0, 1, 1).data
	return { r, g, b }
}

const runWhileVisible = (canvas: HTMLCanvasElement, draw: () => void) => {
	let frame = 0
	let isRunning = false
	let isOnScreen = true

	const loop = () => {
		draw()
		if (isRunning) frame = requestAnimationFrame(loop)
	}
	const start = () => {
		if (isRunning) return
		isRunning = true
		frame = requestAnimationFrame(loop)
	}
	const stop = () => {
		isRunning = false
		cancelAnimationFrame(frame)
	}
	const sync = () => {
		if (isOnScreen && document.visibilityState !== "hidden") start()
		else stop()
	}

	const observer = new IntersectionObserver(([entry]) => {
		isOnScreen = entry?.isIntersecting ?? false
		sync()
	})
	observer.observe(canvas)
	document.addEventListener("visibilitychange", sync)
	draw()

	return () => {
		stop()
		observer.disconnect()
		document.removeEventListener("visibilitychange", sync)
	}
}

type BotOrbProps = {
	seed: string
	name: string
	blot?: BotAvatarBlot
	state?: OrbState
	size?: BotOrbSize
	className?: string
}

const BotOrb = ({
	seed,
	name,
	blot,
	state,
	size = 64,
	className,
}: BotOrbProps) => {
	const { t } = useTranslation("bots")
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const isDark = useResolvedDark("auto", canvasRef)
	const isReducedMotion = usePrefersReducedMotion()
	const isAnimated = state !== undefined && !isReducedMotion
	const tint = orbTint(blot ?? seededBlot(seed))

	useEffect(() => {
		const canvas = canvasRef.current
		const context = canvas?.getContext("2d")
		if (!canvas || !context) return

		const pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1)
		canvas.width = Math.round(size * pixelRatio)
		canvas.height = Math.round(size * pixelRatio)
		const { mode, speed, opts } = resolvePreset(state ?? RESTING_STATE, size)
		const frameAt = MODE_FRAMES[mode]
		const ink = rgbOf(getComputedStyle(canvas).color)

		const paintAt = (seconds: number) => {
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
			context.clearRect(0, 0, size, size)
			paintFrame(context, frameAt(size, seconds, opts), isDark, ink)
		}

		if (!isAnimated) {
			paintAt(STILL_FRAME_SECONDS)
			return
		}
		return runWhileVisible(canvas, () =>
			paintAt((performance.now() / 1000) * speed),
		)
	}, [isAnimated, isDark, size, state])

	return (
		<canvas
			ref={canvasRef}
			data-slot="bot-orb"
			data-state={state ?? "idle"}
			data-animated={isAnimated}
			role="img"
			aria-label={
				state
					? t("identity.orb.label", {
							name,
							state: t(`identity.orb.state.${state}`),
						})
					: name
			}
			className={className}
			style={{ width: size, height: size, display: "block", color: tint }}
		/>
	)
}

export { BOT_ORB_SIZES, BOT_ORB_STATES, BotOrb, type BotOrbProps }
