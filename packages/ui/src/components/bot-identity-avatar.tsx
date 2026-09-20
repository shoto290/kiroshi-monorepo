"use client"

import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import {
	BotAvatar,
	type BotAvatarBlot,
	companionAvatarRadius,
} from "@workspace/ui/components/bot-avatar"
import type { BotAvatarAnimal } from "@workspace/ui/components/bot-avatar-animals"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import { drawnAnimal } from "@workspace/ui/components/bot-settings"
import { Icons } from "@workspace/ui/components/icons"
import { AvatarFrame } from "@workspace/ui/components/initials-avatar"
import { cn } from "@workspace/ui/lib/utils"

const REST_STATE: BotAvatarState = "idle"

type ActivityIndicatorKind = Extract<
	BotAvatarState,
	"thinking" | "searching" | "working" | "writing" | "waiting"
>

const busyStateFor = (kind: ActivityIndicatorKind): BotAvatarState =>
	kind === "waiting" ? "listening" : kind

const DEFAULT_SIZE = 40

const avatarShapeStyle = (size: number) => ({
	borderRadius: companionAvatarRadius(size),
})

type BotIdentityAvatarProps = {
	name?: string
	animal?: BotAvatarAnimal
	blot?: BotAvatarBlot
	seed?: string
	image?: string
	badge?: BotBadge
	working?: boolean
	kind?: ActivityIndicatorKind
	size?: number
	className?: string
}

function BotIdentityAvatar({
	name,
	animal,
	blot,
	seed,
	image,
	badge,
	working = false,
	kind = "thinking",
	size = DEFAULT_SIZE,
	className,
}: BotIdentityAvatarProps) {
	return (
		<AvatarFrame
			className={className}
			image={image}
			overlay={
				badge ? (
					<BotBadgeDot
						badge={badge}
						data-slot="bot-activity-dot"
						placement="avatar"
					/>
				) : null
			}
			radius={companionAvatarRadius(size)}
			size={size}
			slot="bot-identity-avatar"
		>
			<BotAvatar
				animal={drawnAnimal(name, animal)}
				animated={working}
				blot={blot}
				className="block size-full"
				seed={seed}
				size={size}
				state={working ? busyStateFor(kind) : REST_STATE}
			/>
		</AvatarFrame>
	)
}

const STOP_OVERLAY =
	"pointer-events-none absolute inset-0 flex items-center justify-center bg-background/75 text-foreground"

type BotStopProps =
	| { stoppable: true; onStop: () => void }
	| { stoppable?: false; onStop?: () => void }

type BotStopButtonProps = {
	name: string
	size?: number
	onStop: () => void
	children: ReactNode
}

const BotStopButton = ({
	name,
	size = DEFAULT_SIZE,
	onStop,
	children,
}: BotStopButtonProps) => {
	const { t } = useTranslation("chat")
	const [armed, setArmed] = useState(false)

	return (
		<button
			type="button"
			data-slot="bot-working-stop"
			aria-label={t("working.stop", { name })}
			onClick={onStop}
			onPointerEnter={() => setArmed(true)}
			onPointerLeave={() => setArmed(false)}
			onFocus={() => setArmed(true)}
			onBlur={() => setArmed(false)}
			className="relative block w-fit outline-none focus-visible:ring-2 focus-visible:ring-ring"
			style={avatarShapeStyle(size)}
		>
			{children}
			<span
				aria-hidden="true"
				data-slot="bot-working-stop-glyph"
				className={cn(STOP_OVERLAY, armed ? "opacity-100" : "opacity-0")}
				style={avatarShapeStyle(size)}
			>
				<Icons.Stop className="size-1/2" />
			</span>
		</button>
	)
}

export {
	type ActivityIndicatorKind,
	BotIdentityAvatar,
	type BotIdentityAvatarProps,
	BotStopButton,
	type BotStopButtonProps,
	type BotStopProps,
}
