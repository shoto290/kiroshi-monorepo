"use client"

import { useTranslation } from "react-i18next"

import {
	type BotBadge,
	BotBadgeDot,
	botBadgeRingVariants,
} from "@workspace/ui/components/bot-badge"
import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/companion-colour"
import { ContextMenuPressTrigger } from "@workspace/ui/components/context-menu-press-trigger"
import { Icons } from "@workspace/ui/components/icons"
import type { Space } from "@workspace/ui/components/space"
import {
	type SpaceInvitation,
	type SpaceInvitationCallbacks,
	SpaceInvitations,
} from "@workspace/ui/components/space-invitations"
import { Button } from "@workspace/ui/components/ui/button"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
} from "@workspace/ui/components/ui/context-menu"
import {
	dropArea,
	dropAreaAt,
	useRosterLift,
} from "@workspace/ui/hooks/use-roster-lift"
import { SPACE_RANK_LIMIT } from "@workspace/ui/hooks/use-space-shortcut"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const SWITCHER =
	"relative h-8 min-w-0 max-w-64 shrink gap-2 rounded-md px-2 font-normal text-compact text-muted-foreground leading-4"

const SWITCHER_NAME = "min-w-0 truncate"

const SWITCHER_SWATCH = "rounded-[3px]"

const SWITCHER_CHEVRON = "size-3 shrink-0 stroke-2!"

const SWITCHER_REMOTE = "size-3 shrink-0 text-muted-foreground"

const SWITCHER_INVITATION =
	"pointer-events-none absolute end-0.25 top-1 size-1.75 rounded-full bg-primary ring-2 ring-sidebar"

const MENU_RESTING = "max-w-64"

const MENU_INVITED = "w-70"

const ROW_NAME = "min-w-0 grow truncate"

const ROW_NAME_UNREACHABLE = "text-muted-foreground"

const ROW_REMOTE = "size-3.5 shrink-0 text-muted-foreground"

const ROW_UNREACHABLE =
	"shrink-0 whitespace-nowrap text-muted-foreground text-xs"

const ROW_UNREACHABLE_ICON = "size-3.5 shrink-0 text-destructive"

const DOT = "h-2.5 w-2.5 shrink-0 rounded-full"

const DOTS =
	"flex flex-wrap items-center justify-center group-data-[collapsible=icon]:hidden"

const DOT_BUTTON =
	"group/space-dot relative grid size-5 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

const DOT_LIFTED =
	"pointer-events-none z-10 scale-125 drop-shadow-md translate-x-[var(--lift-dx,0px)] translate-y-[var(--lift-dy,0px)]"

const INSERTION_LINE =
	"pointer-events-none absolute inset-y-1 z-20 w-0.5 rounded-full bg-sidebar-primary"

const INSERTION_BEFORE = "start-0"

const INSERTION_AFTER = "end-0"

const DOT_MOTION =
	"transition-[width,background-color] duration-150 ease-out motion-reduce:transition-none"

const DOT_OPEN = "w-4 bg-sidebar-foreground"

const DOT_CLOSED = "group-hover/space-dot:bg-sidebar-foreground"

const DOT_UNTINTED = "bg-sidebar-foreground/30"

const BADGE_RANK: BotBadge[] = ["attention", "failed", "done"]

const strongestBadge = (badges: (BotBadge | undefined)[]) =>
	BADGE_RANK.find((badge) => badges.includes(badge))

const placedOrder = (spaces: Space[], id: string, at: number) => {
	const order = spaces
		.filter((space) => space.id !== id)
		.map((space) => space.id)
	order.splice(at, 0, id)
	return order.every((held, rank) => held === spaces[rank]?.id) ? null : order
}

type SpaceDotProps = {
	colour?: BotAvatarBlot | null
	badge?: BotBadge
	isFilled?: boolean
	className?: string
}

const SpaceDot = ({
	colour,
	badge,
	isFilled = true,
	className,
}: SpaceDotProps) => {
	const tint = isFilled && colour ? blotTint(colour) : undefined

	return (
		<span
			aria-hidden="true"
			className={cn(
				DOT,
				DOT_MOTION,
				!tint && DOT_UNTINTED,
				badge && botBadgeRingVariants({ badge }),
				className,
			)}
			data-badge={badge}
			data-slot="space-dot"
			style={tint ? { backgroundColor: tint } : undefined}
		/>
	)
}

type SpaceSelection = {
	spaces: Space[]
	selectedSpaceId?: string
	badgesBySpaceId?: Record<string, BotBadge>
	onSelectSpace?: (id: string) => void
	onReorderSpaces?: (ids: string[]) => void
}

type SpaceRemote = "connected" | "unreachable"

type SpaceRemoteMarkerProps = {
	remote: SpaceRemote
}

const SpaceRemoteMarker = ({ remote }: SpaceRemoteMarkerProps) => {
	const { t } = useTranslation("bots")

	if (remote === "connected") {
		return (
			<Icons.Web
				aria-hidden={false}
				aria-label={t("spaces.remote")}
				className={ROW_REMOTE}
				data-slot="space-remote"
				role="img"
			/>
		)
	}

	return (
		<>
			<Icons.Alert aria-hidden="true" className={ROW_UNREACHABLE_ICON} />
			<span className={ROW_UNREACHABLE} data-slot="space-unreachable">
				{t("spaces.unreachable")}
			</span>
		</>
	)
}

type SpaceSwitcherProps = SpaceSelection &
	SpaceInvitationCallbacks & {
		remoteBySpaceId?: Record<string, SpaceRemote>
		invitations?: SpaceInvitation[]
		onCreateSpace?: () => void
		onOpenSpaceSettings?: () => void
		onLeaveSpace?: () => void
		onOpenChange?: (isOpen: boolean) => void
	}

const SpaceSwitcher = ({
	spaces,
	selectedSpaceId,
	badgesBySpaceId,
	remoteBySpaceId,
	invitations = [],
	onSelectSpace,
	onReorderSpaces,
	onCreateSpace,
	onOpenSpaceSettings,
	onLeaveSpace,
	onAcceptInvitation,
	onDeclineInvitation,
	onRetryInvitation,
	onOpenChange,
}: SpaceSwitcherProps) => {
	const { t } = useTranslation("bots")
	const selected =
		spaces.find((space) => space.id === selectedSpaceId) ?? spaces[0]

	if (!selected) return null

	const rank = spaces.indexOf(selected)
	const isRemote = Boolean(remoteBySpaceId?.[selected.id])
	const isInvited = invitations.length > 0
	const switchLabel = isInvited
		? isRemote
			? "spaces.switchRemoteInvited"
			: "spaces.switchInvited"
		: isRemote
			? "spaces.switchRemote"
			: "spaces.switch"

	const moveSelected = (by: number) => {
		const order = placedOrder(spaces, selected.id, rank + by)
		if (order) onReorderSpaces?.(order)
	}

	const elsewhere = isInvited
		? undefined
		: strongestBadge(
				spaces
					.filter((space) => space.id !== selected.id)
					.map((space) => badgesBySpaceId?.[space.id]),
			)

	return (
		<ContextMenu onOpenChange={(isOpen) => onOpenChange?.(isOpen)}>
			<ContextMenuPressTrigger
				render={
					<Button
						aria-label={t(switchLabel, {
							count: invitations.length,
							name: selected.name,
						})}
						className={SWITCHER}
						data-slot="space-switcher"
						size="sm"
						variant="ghost"
					>
						<SpaceDot className={SWITCHER_SWATCH} colour={selected.colour} />
						<span className={SWITCHER_NAME} data-slot="space-switcher-name">
							{selected.name}
						</span>
						{isRemote ? (
							<Icons.Web
								aria-hidden="true"
								className={SWITCHER_REMOTE}
								data-slot="space-switcher-remote"
							/>
						) : null}
						<Icons.Expand aria-hidden="true" className={SWITCHER_CHEVRON} />
						{elsewhere ? (
							<BotBadgeDot
								badge={elsewhere}
								data-slot="space-switcher-badge"
								placement="switcher"
							/>
						) : null}
						{isInvited ? (
							<span
								aria-hidden="true"
								className={SWITCHER_INVITATION}
								data-slot="space-switcher-invitation"
							/>
						) : null}
					</Button>
				}
			/>
			<ContextMenuContent
				aria-label={t("spaces.label")}
				className={cn(
					isInvited ? MENU_INVITED : MENU_RESTING,
					STILL_UNDER_REDUCED_MOTION,
				)}
			>
				<ContextMenuRadioGroup
					onValueChange={(value) => onSelectSpace?.(value)}
					value={selected.id}
				>
					{spaces.map((space, index) => {
						const remote = remoteBySpaceId?.[space.id]
						const isUnreachable = remote === "unreachable"
						return (
							<ContextMenuRadioItem
								closeOnClick
								key={space.id}
								label={space.name}
								value={space.id}
							>
								<SpaceDot
									badge={badgesBySpaceId?.[space.id]}
									colour={space.colour}
									isFilled={!isUnreachable}
								/>
								<span
									className={cn(
										ROW_NAME,
										isUnreachable && ROW_NAME_UNREACHABLE,
									)}
								>
									{space.name}
								</span>
								{remote ? <SpaceRemoteMarker remote={remote} /> : null}
								{index < SPACE_RANK_LIMIT ? (
									<ContextMenuShortcut>
										{t("spaces.shortcut", { rank: index + 1 })}
									</ContextMenuShortcut>
								) : null}
							</ContextMenuRadioItem>
						)
					})}
				</ContextMenuRadioGroup>
				<SpaceInvitations
					invitations={invitations}
					onAcceptInvitation={onAcceptInvitation}
					onDeclineInvitation={onDeclineInvitation}
					onRetryInvitation={onRetryInvitation}
				/>
				<ContextMenuSeparator />
				{spaces.length > 1 ? (
					<>
						<ContextMenuItem
							disabled={rank === 0}
							onClick={() => moveSelected(-1)}
						>
							<Icons.ArrowUp aria-hidden="true" className="size-3.5" />
							{t("spaces.moveUp")}
						</ContextMenuItem>
						<ContextMenuItem
							disabled={rank === spaces.length - 1}
							onClick={() => moveSelected(1)}
						>
							<Icons.ArrowDown aria-hidden="true" className="size-3.5" />
							{t("spaces.moveDown")}
						</ContextMenuItem>
						<ContextMenuSeparator />
					</>
				) : null}
				<ContextMenuItem onClick={onCreateSpace}>
					<Icons.Add aria-hidden="true" className="size-3.5" />
					{t("spaces.create")}
				</ContextMenuItem>
				<ContextMenuItem onClick={onOpenSpaceSettings}>
					<Icons.Settings aria-hidden="true" className="size-3.5" />
					{t("spaces.settings")}
				</ContextMenuItem>
				{isRemote ? (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={onLeaveSpace} variant="destructive">
							<Icons.Leave aria-hidden="true" className="size-3.5" />
							{t("spaces.leave")}
						</ContextMenuItem>
					</>
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}

const SpaceDots = ({
	spaces,
	selectedSpaceId,
	badgesBySpaceId,
	onSelectSpace,
	onReorderSpaces,
}: SpaceSelection) => {
	const { t } = useTranslation("bots")

	const placeSpace = (id: string, at: number) => {
		const order = placedOrder(spaces, id, at)
		if (order) onReorderSpaces?.(order)
	}

	const insertionAt = (x: number, y: number) => {
		const over = dropAreaAt(x, y)
		const rank = spaces.findIndex((space) => space.id === over)
		return rank < 0 ? null : rank
	}

	const lift = useRosterLift({
		isEnabled: spaces.length > 1,
		landingAt: insertionAt,
		onLand: placeSpace,
	})

	if (spaces.length < 2) return null

	const liftedId = lift.lift?.id
	const insertion = lift.lift?.landing ?? null
	const placed = spaces.filter((space) => space.id !== liftedId)
	const insertsBefore = insertion === null ? null : placed[insertion]?.id
	const insertsAfter =
		insertion !== null && insertion >= placed.length
			? placed[placed.length - 1]?.id
			: null

	return (
		<span
			aria-label={t("spaces.label")}
			className={DOTS}
			data-slot="space-dots"
			data-tauri-drag-region="false"
			role="group"
		>
			{spaces.map((space) => {
				const isSelected = space.id === selectedSpaceId
				const isLifted = space.id === liftedId
				const edge =
					insertsBefore === space.id
						? INSERTION_BEFORE
						: insertsAfter === space.id
							? INSERTION_AFTER
							: null
				return (
					<button
						{...dropArea(space.id)}
						{...lift.handlersFor(space.id)}
						aria-current={isSelected}
						aria-label={t("spaces.open", { name: space.name })}
						className={cn(DOT_BUTTON, isLifted && DOT_LIFTED)}
						data-slot="space-dot-button"
						key={space.id}
						onClick={() => {
							if (lift.hasJustDropped()) return
							onSelectSpace?.(space.id)
						}}
						ref={isLifted ? lift.followRef : undefined}
						type="button"
					>
						{edge ? (
							<span
								className={cn(INSERTION_LINE, edge)}
								data-slot="space-insertion"
							/>
						) : null}
						<SpaceDot
							badge={badgesBySpaceId?.[space.id]}
							className={isSelected ? DOT_OPEN : DOT_CLOSED}
							colour={space.colour}
							isFilled={isSelected}
						/>
					</button>
				)
			})}
		</span>
	)
}

export {
	SpaceDot,
	SpaceDots,
	type SpaceRemote,
	SpaceSwitcher,
	type SpaceSwitcherProps,
}
