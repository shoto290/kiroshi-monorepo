"use client"

import {
	type Ref,
	type RefObject,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react"

import type { ExplorationState } from "@workspace/ui/components/avatar-exploration"
import { DitheredFieldAvatar } from "@workspace/ui/components/dithered-field-avatar"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const BRAND_NAME = "Kiroshi"

const BRAND_TINT = "blue"

const BRAND_SCREEN = "halftone"

const RESTING_STATE: ExplorationState = "idle"

const PLAYABLE_STATES: ExplorationState[] = [
	"thinking",
	"searching",
	"working",
	"writing",
	"waiting",
]

const PLAY_DURATION = 2600
const REST_DELAY = [2400, 6800] as const

const restDelay = () =>
	REST_DELAY[0] + Math.random() * (REST_DELAY[1] - REST_DELAY[0])

type PlayOneState = {
	lastPlayed: RefObject<ExplorationState>
	onPlay: (state: ExplorationState) => void
}

const playOneState = ({ lastPlayed, onPlay }: PlayOneState) => {
	const pool = PLAYABLE_STATES.filter(
		(candidate) => candidate !== lastPlayed.current,
	)
	const next = pool[Math.floor(Math.random() * pool.length)]
	lastPlayed.current = next
	onPlay(next)
}

type BrandMarkProps = {
	size: number
	state?: ExplorationState
}

const BrandMark = ({ size, state = RESTING_STATE }: BrandMarkProps) => (
	<DitheredFieldAvatar
		name={BRAND_NAME}
		screen={BRAND_SCREEN}
		size={size}
		state={state}
		tint={BRAND_TINT}
	/>
)

const DEFAULT_SIZE = 72

type AppIconMarkHandle = {
	play: () => void
}

type AppIconMarkProps = {
	size?: number
	className?: string
	ref?: Ref<AppIconMarkHandle>
}

const AppIconMark = ({
	size = DEFAULT_SIZE,
	className,
	ref,
}: AppIconMarkProps) => {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [state, setState] = useState<ExplorationState>(RESTING_STATE)
	const lastPlayedRef = useRef<ExplorationState>(RESTING_STATE)

	useImperativeHandle(ref, () => ({
		play: () => playOneState({ lastPlayed: lastPlayedRef, onPlay: setState }),
	}))

	useEffect(() => {
		if (prefersReducedMotion) {
			setState(RESTING_STATE)
			return
		}
		const isResting = state === RESTING_STATE
		const timer = setTimeout(
			() => {
				if (isResting) {
					playOneState({ lastPlayed: lastPlayedRef, onPlay: setState })
					return
				}
				setState(RESTING_STATE)
			},
			isResting ? restDelay() : PLAY_DURATION,
		)
		return () => clearTimeout(timer)
	}, [prefersReducedMotion, state])

	return (
		<span
			aria-hidden="true"
			className={cn("inline-flex shrink-0", className)}
			data-slot="app-icon-mark"
			data-state={state}
		>
			<BrandMark size={size} state={state} />
		</span>
	)
}

export {
	AppIconMark,
	type AppIconMarkHandle,
	type AppIconMarkProps,
	BRAND_NAME,
	BrandMark,
}
