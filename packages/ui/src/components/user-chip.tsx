"use client"

import {
	displayNameOf,
	InitialsAvatar,
} from "@workspace/ui/components/initials-avatar"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import { cn } from "@workspace/ui/lib/utils"

const CHIP = "min-w-0 flex-1 px-1 group-data-[collapsible=icon]:flex-none"

type UserChipIdentity = {
	name?: string
	image?: string
}

type UserChipProps = UserChipIdentity & {
	onOpen?: () => void
	className?: string
}

const UserChip = ({ name, image, onOpen, className }: UserChipProps) => {
	const displayName = displayNameOf(name)

	return (
		<SidebarMenuRow
			className={cn(CHIP, className)}
			icon={<InitialsAvatar image={image} name={displayName} />}
			label={displayName}
			onSelect={onOpen}
		>
			{displayName}
		</SidebarMenuRow>
	)
}

export { UserChip, type UserChipIdentity, type UserChipProps }
