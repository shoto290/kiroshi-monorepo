import type { CSSProperties, ReactNode } from "react"

import { COMPANION_SILHOUETTE } from "@workspace/ui/components/companion-picture"
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/ui/avatar"
import { cn } from "@workspace/ui/lib/utils"

const FALLBACK_NAME = "You"

const DEFAULT_SIZE = 28

const INITIALS_RATIO = 0.4

type AvatarShape = "hexagon" | "round"

const FRAME_CLASS: Record<AvatarShape, string> = {
	hexagon: "block rounded-none after:hidden",
	round: "block overflow-hidden rounded-full after:hidden",
}

const PICTURE_LAYER: Record<AvatarShape, string> = {
	hexagon: "rounded-none",
	round: "rounded-full",
}

const LAYER_MASK: Record<AvatarShape, CSSProperties | undefined> = {
	hexagon: COMPANION_SILHOUETTE,
	round: undefined,
}

const INITIALS_CLASS =
	"grid size-full place-items-center bg-sidebar-accent font-medium text-sidebar-accent-foreground uppercase leading-none"

const displayNameOf = (name?: string) => name?.trim() || FALLBACK_NAME

const initialsOf = (name: string) =>
	name
		.split(/\s+/, 2)
		.map((word) => Array.from(word)[0])
		.join("")

type AvatarFrameProps = {
	slot: string
	shape: AvatarShape
	size: number
	image?: string
	overlay?: ReactNode
	className?: string
	children: ReactNode
}

const AvatarFrame = ({
	slot,
	shape,
	size,
	image,
	overlay,
	className,
	children,
}: AvatarFrameProps) => (
	<Avatar
		className={cn(FRAME_CLASS[shape], className)}
		data-slot={slot}
		style={{ width: size, height: size }}
	>
		{image ? (
			<AvatarImage
				alt=""
				aria-hidden="true"
				className={PICTURE_LAYER[shape]}
				src={image}
				style={LAYER_MASK[shape]}
			/>
		) : (
			<AvatarFallback
				className={cn(PICTURE_LAYER[shape], "bg-transparent text-inherit")}
				style={LAYER_MASK[shape]}
			>
				{children}
			</AvatarFallback>
		)}
		{overlay}
	</Avatar>
)

type InitialsAvatarProps = {
	name?: string
	image?: string
	size?: number
	className?: string
}

const InitialsAvatar = ({
	name,
	image,
	size = DEFAULT_SIZE,
	className,
}: InitialsAvatarProps) => (
	<AvatarFrame
		className={className}
		image={image}
		shape="round"
		size={size}
		slot="user-avatar"
	>
		<span
			aria-hidden="true"
			className={INITIALS_CLASS}
			style={{ fontSize: Math.round(size * INITIALS_RATIO) }}
		>
			{initialsOf(displayNameOf(name))}
		</span>
	</AvatarFrame>
)

export { AvatarFrame, displayNameOf, InitialsAvatar }
