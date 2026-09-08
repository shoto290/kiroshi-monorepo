"use client"

import {
	type CSSProperties,
	type Ref,
	type RefObject,
	useEffect,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react"

import { BotAvatar } from "@workspace/ui/components/bot-avatar"
import {
	type BotAvatarState,
	STATE_GROUPS,
} from "@workspace/ui/components/bot-avatar-data"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const GROUND_VIEW_BOX = 512

const GROUND_PATH =
	"M0 152.867C0 108.849 0 86.8407 7.49114 63.1494C16.906 37.2824 37.2824 16.906 63.1494 7.49114C86.8407 0 108.849 0 152.867 0H359.134C403.151 0 425.159 0 448.851 7.49114C474.718 16.906 495.094 37.2824 504.509 63.1494C512 86.8407 512 108.849 512 152.867V359.134C512 403.151 512 425.159 504.509 448.851C495.094 474.718 474.718 495.094 448.851 504.509C425.159 512 403.151 512 359.134 512H152.867C108.849 512 86.8407 512 63.1494 504.509C37.2824 495.094 16.906 474.718 7.49114 448.851C0 425.159 0 403.151 0 359.134V152.867Z"

const GROUND_EDGE_PATH =
	"M152.866 3H359.134C403.244 3 424.742 3.02886 447.874 10.3291C472.867 19.4425 492.556 39.1321 501.67 64.125C508.971 87.2573 509 108.755 509 152.866V359.134C509 403.244 508.97 424.742 501.67 447.874C492.556 472.867 472.867 492.556 447.874 501.67C424.742 508.97 403.244 509 359.134 509H152.866C108.755 509 87.2573 508.971 64.125 501.67C39.1321 492.556 19.4425 472.867 10.3291 447.874C3.02886 424.742 3 403.244 3 359.134V152.866C3 108.755 3.02859 87.2572 10.3291 64.125C19.4427 39.1322 39.1322 19.4427 64.125 10.3291C87.2572 3.02859 108.755 3 152.866 3Z"

const GROUND_FILL = "#FEFCEE"

const RABBIT_TRANSFORM = "translate(-110.4 -14.2) scale(3.41)"

const RABBIT_INK_STYLE = {
	color: "var(--bot-blot-ink)",
	"--bot-avatar-ink": "var(--bot-blot-ink)",
} as CSSProperties

const RESTING_STATE: BotAvatarState = "waiting"

const PLAYABLE_STATES = Object.values(STATE_GROUPS)
	.flat()
	.filter((state) => state !== RESTING_STATE)

const PLAY_DURATION = 2600
const REST_DELAY = [2400, 6800] as const

const restDelay = () =>
	REST_DELAY[0] + Math.random() * (REST_DELAY[1] - REST_DELAY[0])

type PlayOneState = {
	lastPlayed: RefObject<BotAvatarState>
	onPlay: (state: BotAvatarState) => void
}

const playOneState = ({ lastPlayed, onPlay }: PlayOneState) => {
	const pool = PLAYABLE_STATES.filter(
		(candidate) => candidate !== lastPlayed.current,
	)
	const next = pool[Math.floor(Math.random() * pool.length)]
	lastPlayed.current = next
	onPlay(next)
}

const DEFAULT_SIZE = 72

type AppIconMarkHandle = {
	play: () => void
}

type AppIconMarkProps = {
	size?: number
	label?: string
	className?: string
	ref?: Ref<AppIconMarkHandle>
}

const AppIconMark = ({
	size = DEFAULT_SIZE,
	label,
	className,
	ref,
}: AppIconMarkProps) => {
	const id = useId()
	const clipId = `app-icon-mark-clip-${id}`
	const edgeId = `app-icon-mark-edge-${id}`
	const prefersReducedMotion = usePrefersReducedMotion()
	const [state, setState] = useState<BotAvatarState>(RESTING_STATE)
	const lastPlayedRef = useRef<BotAvatarState>(RESTING_STATE)

	useImperativeHandle(ref, () => ({
		play: () => playOneState({ lastPlayed: lastPlayedRef, onPlay: setState }),
	}))

	useEffect(() => {
		if (prefersReducedMotion) return
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
		<svg
			aria-hidden={label ? undefined : true}
			aria-label={label}
			className={cn("shrink-0", className)}
			data-slot="app-icon-mark"
			data-state={state}
			focusable="false"
			height={size}
			role={label ? "img" : undefined}
			style={RABBIT_INK_STYLE}
			viewBox={`0 0 ${GROUND_VIEW_BOX} ${GROUND_VIEW_BOX}`}
			width={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<clipPath id={clipId}>
					<path d={GROUND_PATH} />
				</clipPath>
				<linearGradient
					gradientUnits="userSpaceOnUse"
					id={edgeId}
					x1="47"
					x2="481"
					y1="16.5"
					y2="491"
				>
					<stop stopColor="white" />
					<stop offset="0.5" />
					<stop offset="1" stopColor="white" />
				</linearGradient>
			</defs>
			<path d={GROUND_PATH} fill={GROUND_FILL} />
			<g clipPath={`url(#${clipId})`}>
				<g transform={RABBIT_TRANSFORM}>
					<BotAvatar
						animated={!prefersReducedMotion}
						perspective={0}
						size={240}
						state={state}
					/>
				</g>
			</g>
			<path
				d={GROUND_EDGE_PATH}
				fill="none"
				stroke={`url(#${edgeId})`}
				strokeOpacity={0.4}
				strokeWidth={6}
			/>
		</svg>
	)
}

export { AppIconMark, type AppIconMarkHandle, type AppIconMarkProps }
