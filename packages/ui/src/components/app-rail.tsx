"use client"

import type { ComponentProps, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	AvatarFrame,
	displayNameOf,
	initialsOf,
} from "@workspace/ui/components/initials-avatar"
import { TooltipButton } from "@workspace/ui/components/tooltip-button"
import type { UserChipIdentity } from "@workspace/ui/components/user-chip"
import { cn } from "@workspace/ui/lib/utils"

type AppRailPanel = "conversations" | "missions" | "companions" | "applications"

type AppRailEntry = AppRailPanel | "settings" | "you"

type AppRailCounts = Partial<Record<AppRailEntry, number>>

type AppRailDots = Partial<Record<AppRailEntry, boolean>>

const RAIL = "flex w-13 shrink-0 flex-col justify-between gap-1 px-2 pt-2 pb-1"

const RAIL_GROUP = "flex flex-col gap-1"

const RAIL_ITEM =
	"relative size-9 rounded-md text-muted-foreground hover:text-foreground aria-[current=true]:bg-rail-item-selected aria-[current=true]:text-foreground [&_svg]:size-4.5 [&_svg]:stroke-[1.75]!"

const RAIL_DOT =
	"pointer-events-none absolute -end-px -top-px size-2 rounded-full bg-primary ring-2 ring-(--shell-surface,var(--background)) transition-shadow duration-400 ease-out motion-reduce:transition-none"

const RAIL_COUNT =
	"pointer-events-none absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-primary-foreground text-xs/4 tabular-nums ring-2 ring-(--shell-surface,var(--background)) transition-shadow duration-400 ease-out motion-reduce:transition-none"

const RAIL_AVATAR =
	"grid size-full place-items-center bg-rail-avatar font-medium text-foreground text-xs/4 uppercase"

const AVATAR_SIZE = 26

const COUNT_CEILING = 99

const shownCount = (count: number) =>
	count > COUNT_CEILING ? `${COUNT_CEILING}+` : String(count)

type RailBadgeProps = { count?: number; hasDot?: boolean }

const RailBadge = ({ count = 0, hasDot }: RailBadgeProps) => {
	if (count > 0)
		return (
			<span
				aria-hidden="true"
				className={RAIL_COUNT}
				data-slot="app-rail-count"
			>
				{shownCount(count)}
			</span>
		)
	if (hasDot)
		return (
			<span aria-hidden="true" className={RAIL_DOT} data-slot="app-rail-dot" />
		)
	return null
}

type RailItemProps = {
	name: string
	count?: number
	hasDot?: boolean
	isSelected?: boolean
	onPress?: () => void
	children: ReactNode
}

const RailItem = ({
	name,
	count = 0,
	hasDot,
	isSelected,
	onPress,
	children,
}: RailItemProps) => {
	const { t } = useTranslation("bots")
	const spokenName =
		count > 0
			? t("rail.count", { count, name })
			: hasDot
				? t("rail.dot", { name })
				: name

	return (
		<li>
			<TooltipButton
				aria-current={isSelected ? "true" : undefined}
				aria-label={spokenName}
				className={RAIL_ITEM}
				data-slot="app-rail-item"
				onClick={onPress}
				size="icon-lg"
				tooltip={name}
				tooltipSide="right"
				variant="ghost"
			>
				{children}
				<RailBadge count={count} hasDot={hasDot} />
			</TooltipButton>
		</li>
	)
}

type RailAvatarProps = UserChipIdentity

const RailAvatar = ({ name, image }: RailAvatarProps) => (
	<AvatarFrame
		image={image}
		shape="round"
		size={AVATAR_SIZE}
		slot="app-rail-avatar"
	>
		<span aria-hidden="true" className={RAIL_AVATAR}>
			{initialsOf(displayNameOf(name))}
		</span>
	</AvatarFrame>
)

type AppRailProps = Omit<ComponentProps<"nav">, "children"> & {
	selected: AppRailPanel
	counts?: AppRailCounts
	dots?: AppRailDots
	user?: UserChipIdentity
	onSelectConversations?: () => void
	onSelectMissions?: () => void
	onSelectCompanions?: () => void
	onSelectApplications?: () => void
	onOpenSettings?: () => void
	onOpenYou?: () => void
}

const AppRail = ({
	selected,
	counts,
	dots,
	user,
	onSelectConversations,
	onSelectMissions,
	onSelectCompanions,
	onSelectApplications,
	onOpenSettings,
	onOpenYou,
	className,
	...props
}: AppRailProps) => {
	const { t } = useTranslation("bots")
	const badgeOf = (entry: AppRailEntry) => ({
		count: counts?.[entry],
		hasDot: dots?.[entry],
	})
	const panelEntry = (entry: AppRailPanel) => ({
		...badgeOf(entry),
		isSelected: selected === entry,
		name: t(`rail.${entry}`),
	})

	return (
		<nav
			{...props}
			aria-label={t("rail.label")}
			className={cn(RAIL, className)}
			data-slot="app-rail"
		>
			<ul className={RAIL_GROUP}>
				<RailItem
					{...panelEntry("conversations")}
					onPress={onSelectConversations}
				>
					<Icons.Conversations aria-hidden="true" />
				</RailItem>
				<RailItem {...panelEntry("missions")} onPress={onSelectMissions}>
					<Icons.Missions aria-hidden="true" />
				</RailItem>
				<RailItem {...panelEntry("companions")} onPress={onSelectCompanions}>
					<Icons.Companions aria-hidden="true" />
				</RailItem>
				<RailItem
					{...panelEntry("applications")}
					onPress={onSelectApplications}
				>
					<Icons.Applications aria-hidden="true" />
				</RailItem>
			</ul>
			<ul className={RAIL_GROUP}>
				<RailItem
					{...badgeOf("settings")}
					name={t("rail.settings")}
					onPress={onOpenSettings}
				>
					<Icons.Settings aria-hidden="true" />
				</RailItem>
				<RailItem
					{...badgeOf("you")}
					name={displayNameOf(user?.name)}
					onPress={onOpenYou}
				>
					<RailAvatar image={user?.image} name={user?.name} />
				</RailItem>
			</ul>
		</nav>
	)
}

export {
	AppRail,
	type AppRailCounts,
	type AppRailDots,
	type AppRailEntry,
	type AppRailPanel,
	type AppRailProps,
}
