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

type AppRailPanel = "conversations" | "missions"

type AppRailEntry = AppRailPanel | "settings" | "you"

type AppRailDots = Partial<Record<AppRailEntry, boolean>>

const RAIL =
	"flex w-13 shrink-0 flex-col justify-between gap-1 px-2 pt-1.75 pb-[calc(var(--shell-inset)-var(--spacing))]"

const NAVIGATION_ROW_GAP = "gap-0.5"

const RAIL_GROUP = `flex flex-col ${NAVIGATION_ROW_GAP}`

const RAIL_SLOT = "flex empty:hidden"

const RAIL_ITEM =
	"relative size-9 rounded-md text-muted-foreground hover:bg-rail-item-selected/50 hover:text-foreground dark:hover:bg-rail-item-selected/50 aria-[current=true]:bg-rail-item-selected aria-[current=true]:text-foreground dark:aria-[current=true]:bg-rail-item-selected [&_svg]:size-4.5 [&_svg]:stroke-[1.75]!"

const RAIL_DOT =
	"pointer-events-none absolute -end-px -top-px size-2 rounded-full bg-primary ring-2 ring-(--shell-surface,var(--background)) transition-shadow duration-400 ease-out motion-reduce:transition-none"

const RAIL_AVATAR =
	"grid size-full place-items-center bg-rail-avatar font-medium text-foreground text-xs/4 uppercase"

const AVATAR_SIZE = 26

type RailItemProps = {
	name: string
	hasDot?: boolean
	isSelected?: boolean
	onPress?: () => void
	children: ReactNode
}

const RailItem = ({
	name,
	hasDot,
	isSelected,
	onPress,
	children,
}: RailItemProps) => {
	const { t } = useTranslation("bots")
	const spokenName = hasDot ? t("rail.dot", { name }) : name

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
				{hasDot ? (
					<span
						aria-hidden="true"
						className={RAIL_DOT}
						data-slot="app-rail-dot"
					/>
				) : null}
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
	dots?: AppRailDots
	user?: UserChipIdentity
	updateBadge?: ReactNode
	onSelectConversations?: () => void
	onSelectMissions?: () => void
	isGraphOpen?: boolean
	onToggleGraph?: () => void
	onOpenSpaceSettings?: () => void
	onOpenYou?: () => void
}

const AppRail = ({
	selected,
	dots,
	user,
	updateBadge,
	onSelectConversations,
	onSelectMissions,
	isGraphOpen = false,
	onToggleGraph,
	onOpenSpaceSettings,
	onOpenYou,
	className,
	...props
}: AppRailProps) => {
	const { t } = useTranslation("bots")
	const panelEntry = (entry: AppRailPanel) => ({
		hasDot: dots?.[entry],
		isSelected: !isGraphOpen && selected === entry,
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
				{onToggleGraph ? (
					<RailItem
						isSelected={isGraphOpen}
						name={t("rail.graph")}
						onPress={onToggleGraph}
					>
						<Icons.Graph aria-hidden="true" />
					</RailItem>
				) : null}
			</ul>
			<ul className={RAIL_GROUP}>
				{updateBadge ? (
					<li className={RAIL_SLOT} data-slot="app-rail-update">
						{updateBadge}
					</li>
				) : null}
				<RailItem
					hasDot={dots?.settings}
					name={t("rail.spaceSettings")}
					onPress={onOpenSpaceSettings}
				>
					<Icons.Settings aria-hidden="true" />
				</RailItem>
				<RailItem
					hasDot={dots?.you}
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
	type AppRailDots,
	type AppRailPanel,
	type AppRailProps,
	NAVIGATION_ROW_GAP,
}
