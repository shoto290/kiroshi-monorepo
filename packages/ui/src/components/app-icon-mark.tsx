"use client"

import {
	type Ref,
	type RefObject,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react"

import { brandRingField } from "@workspace/ui/components/brand-ring-field"
import {
	companionSeed,
	type FieldState,
} from "@workspace/ui/components/companion-field"
import {
	DitheredField,
	FIELD_CELLS,
} from "@workspace/ui/components/dithered-field-avatar"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const BRAND_NAME = "Kiroshi"

const BRAND_FIELD = brandRingField(companionSeed(BRAND_NAME), FIELD_CELLS)

const BRAND_CELLS = "var(--brand-mark-cells)"

const BRAND_GROUND = "var(--brand-mark-ground)"

const RESTING_STATE: FieldState = "idle"

const PLAYABLE_STATES: FieldState[] = [
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
	lastPlayed: RefObject<FieldState>
	onPlay: (state: FieldState) => void
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
	state?: FieldState
}

const BrandMark = ({ size, state = RESTING_STATE }: BrandMarkProps) => (
	<DitheredField
		field={BRAND_FIELD}
		ink={BRAND_CELLS}
		name={BRAND_NAME}
		size={size}
		state={state}
		surface={BRAND_GROUND}
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
	const [state, setState] = useState<FieldState>(RESTING_STATE)
	const lastPlayedRef = useRef<FieldState>(RESTING_STATE)

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
	BRAND_FIELD,
	BRAND_NAME,
	BrandMark,
	PLAYABLE_STATES,
}
