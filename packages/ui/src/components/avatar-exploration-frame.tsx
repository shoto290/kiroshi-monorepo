"use client"

import { type ReactNode, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
	type ExplorationAvatarProps,
	type ExplorationState,
	stillTime,
} from "@workspace/ui/components/avatar-exploration"
import type { BotAvatarBlot } from "@workspace/ui/components/companion-colour"
import {
	COMPANION_SILHOUETTE,
	companionPictureRadius,
} from "@workspace/ui/components/companion-picture"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

type Paint = (time: number) => void

type ExplorationFrameProps = Required<Omit<ExplorationAvatarProps, "tint">> & {
	tint?: BotAvatarBlot
	surface?: string
	children: ReactNode
}

type ExplorationClock = { state: ExplorationState; paint: Paint }

const painters = new Set<Paint>()
let frame = 0

const tick = (now: number) => {
	for (const paint of painters) paint(now)
	frame = painters.size > 0 ? requestAnimationFrame(tick) : 0
}

const subscribe = (paint: Paint) => {
	painters.add(paint)
	if (frame === 0) frame = requestAnimationFrame(tick)
	return () => {
		painters.delete(paint)
		if (painters.size > 0) return
		cancelAnimationFrame(frame)
		frame = 0
	}
}

const ExplorationFrame = ({
	name,
	tint,
	state,
	size,
	surface,
	children,
}: ExplorationFrameProps) => {
	const { t } = useTranslation("common")

	return (
		<span
			aria-label={name.trim() || t("companion.unnamed")}
			className={cn(
				"relative inline-flex shrink-0 overflow-hidden",
				tint ? "text-(--bot-blot-ink)" : "text-(--bot-avatar-ink)",
			)}
			data-slot="avatar-exploration"
			data-state={state}
			role="img"
			style={{
				width: size,
				height: size,
				...(surface && COMPANION_SILHOUETTE),
				borderRadius: surface ? companionPictureRadius(size) : undefined,
				backgroundColor: surface,
			}}
		>
			{children}
		</span>
	)
}

const useExplorationClock = ({ state, paint }: ExplorationClock) => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const isAnimated = state !== "idle" && !prefersReducedMotion
	const latestPaint = useRef(paint)
	latestPaint.current = paint

	useEffect(() => {
		if (isAnimated) return subscribe((time) => latestPaint.current(time))
	}, [isAnimated])

	useEffect(() => {
		if (!isAnimated) latestPaint.current(stillTime(state))
	})
}

export { ExplorationFrame, useExplorationClock }
