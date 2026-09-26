"use client"

import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { AsciiGlyphAvatar } from "@workspace/ui/components/ascii-glyph-avatar"
import type { BotAvatarBlot } from "@workspace/ui/components/bot-avatar"
import type { BotAvatarAnimal } from "@workspace/ui/components/bot-avatar-animals"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import { companionPictureRadius } from "@workspace/ui/components/companion-picture"
import { Icons } from "@workspace/ui/components/icons"
import { AvatarFrame } from "@workspace/ui/components/initials-avatar"
import { cn } from "@workspace/ui/lib/utils"

type ActivityIndicatorKind = Extract<
	BotAvatarState,
	"thinking" | "searching" | "working" | "writing" | "waiting"
>

const DEFAULT_SIZE = 40

const pictureShapeStyle = (size: number) => ({
	borderRadius: companionPictureRadius(size),
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
			imageRadius={companionPictureRadius(size)}
			overlay={
				badge ? (
					<BotBadgeDot
						badge={badge}
						data-slot="bot-activity-dot"
						placement="avatar"
					/>
				) : null
			}
			size={size}
			slot="bot-identity-avatar"
		>
			<AsciiGlyphAvatar
				name={name ?? seed ?? ""}
				size={size}
				state={working ? kind : "idle"}
				tint={blot}
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
	image?: string
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
			className="relative block w-fit rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			style={pictureShapeStyle(size)}
		>
			{children}
			<span
				aria-hidden="true"
				data-slot="bot-working-stop-glyph"
				className={cn(STOP_OVERLAY, armed ? "opacity-100" : "opacity-0")}
				style={pictureShapeStyle(size)}
			>
				<Icons.Stop className="size-1/2" />
			</span>
		</button>
	)
}

type BotSelectButtonProps = {
	name: string
	image?: string
	size?: number
	onSelect: () => void
	children: ReactNode
}

const BotSelectButton = ({
	name,
	size = DEFAULT_SIZE,
	onSelect,
	children,
}: BotSelectButtonProps) => (
	<button
		type="button"
		data-slot="bot-select"
		aria-label={name}
		onClick={onSelect}
		className="block w-fit cursor-pointer rounded-full outline-none transition-opacity duration-150 ease-out hover:not-focus-visible:opacity-70 hover:transition-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
		style={pictureShapeStyle(size)}
	>
		{children}
	</button>
)

export {
	type ActivityIndicatorKind,
	BotIdentityAvatar,
	type BotIdentityAvatarProps,
	BotSelectButton,
	type BotSelectButtonProps,
	BotStopButton,
	type BotStopButtonProps,
	type BotStopProps,
}
