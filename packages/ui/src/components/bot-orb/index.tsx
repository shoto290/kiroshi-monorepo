"use client"

import { botAvatarShapes } from "bot-avatars"
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
import type { OrbSize, OrbState } from "@workspace/ui/components/bot-orb/types"
import {
	SHAPE_SCALE,
	seededBlot,
	seededShape,
	tileFrameStyle,
	VARIANT_CLASSES,
} from "@workspace/ui/components/bot-tile"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

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

const ORB_SIZE: OrbSize = 20
const SHAPE_SIZE = ORB_SIZE * SHAPE_SCALE
const SHAPE_INSET = (ORB_SIZE - SHAPE_SIZE) / 2
const SHAPE_DESIGN_UNITS = 100
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
	size?: number
	className?: string
}

const BotOrb = ({
	seed,
	name,
	blot,
	state,
	size = ORB_SIZE,
	className,
}: BotOrbProps) => {
	const { t } = useTranslation("bots")
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const isDark = useResolvedDark("auto", canvasRef)
	const isReducedMotion = usePrefersReducedMotion()
	const isAnimated = state !== undefined && !isReducedMotion
	const resolvedBlot = blot ?? seededBlot(seed)
	const shape = seededShape({ seed, includeCharacters: false })
	const tint = orbTint(resolvedBlot)

	useEffect(() => {
		const canvas = canvasRef.current
		const context = canvas?.getContext("2d")
		if (!canvas || !context) return

		const pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1)
		const devicePixelsPerOrbPixel = (pixelRatio * size) / ORB_SIZE
		canvas.width = Math.round(size * pixelRatio)
		canvas.height = Math.round(size * pixelRatio)
		const { mode, speed, opts } = resolvePreset(
			state ?? RESTING_STATE,
			ORB_SIZE,
		)
		const frameAt = MODE_FRAMES[mode]
		canvas.style.color = tint
		const ink = rgbOf(getComputedStyle(canvas).color)
		const silhouette = new Path2D(botAvatarShapes[shape])
		const silhouetteScale =
			(devicePixelsPerOrbPixel * SHAPE_SIZE) / SHAPE_DESIGN_UNITS
		const silhouetteOffset = devicePixelsPerOrbPixel * SHAPE_INSET

		const paintAt = (seconds: number) => {
			context.setTransform(1, 0, 0, 1, 0, 0)
			context.clearRect(0, 0, canvas.width, canvas.height)
			context.save()
			context.setTransform(
				silhouetteScale,
				0,
				0,
				silhouetteScale,
				silhouetteOffset,
				silhouetteOffset,
			)
			context.clip(silhouette)
			context.setTransform(
				devicePixelsPerOrbPixel,
				0,
				0,
				devicePixelsPerOrbPixel,
				0,
				0,
			)
			paintFrame(context, frameAt(ORB_SIZE, seconds, opts), isDark, ink)
			context.restore()
		}

		if (!isAnimated) {
			paintAt(STILL_FRAME_SECONDS)
			return
		}
		return runWhileVisible(canvas, () =>
			paintAt((performance.now() / 1000) * speed),
		)
	}, [isAnimated, isDark, shape, size, state, tint])

	return (
		<div
			data-slot="bot-orb"
			data-state={state ?? "idle"}
			data-animated={isAnimated}
			data-shape={shape}
			role="img"
			aria-label={
				state
					? t("identity.orb.label", {
							name,
							state: t(`identity.orb.state.${state}`),
						})
					: name
			}
			className={cn(
				"shrink-0 overflow-hidden",
				VARIANT_CLASSES.tinted,
				className,
			)}
			style={tileFrameStyle({ size, blot: resolvedBlot })}
		>
			<canvas
				ref={canvasRef}
				data-slot="bot-orb-dots"
				className="block size-full"
			/>
		</div>
	)
}

export { BOT_ORB_STATES, BotOrb, type BotOrbProps }
