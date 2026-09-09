"use client"

import type { TFunction } from "i18next"
import { useReducedMotion } from "motion/react"
import {
	type ComponentProps,
	memo,
	type ReactNode,
	type UIEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import {
	AvatarGroup,
	type ConversationParticipant,
} from "@workspace/ui/components/avatar-group"
import {
	BotAvatar,
	type BotAvatarBlot,
} from "@workspace/ui/components/bot-avatar"
import type { BotAvatarAnimal } from "@workspace/ui/components/bot-avatar-animals"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import {
	type BotBadge,
	BotBadgeDot,
	type BotMissionState,
	BotMissionStrip,
	type BotMissionTicket,
	BotTitleBadge,
} from "@workspace/ui/components/bot-badge"
import {
	type ActivityIndicatorKind,
	BotIdentityAvatar,
} from "@workspace/ui/components/bot-identity-avatar"
import { BOT_IDENTITY_ANIMALS } from "@workspace/ui/components/bot-settings"
import { ContextMenuPressTrigger } from "@workspace/ui/components/context-menu-press-trigger"
import { Icons } from "@workspace/ui/components/icons"
import {
	TextShimmer,
	WORKING_SHIMMER_DURATION,
} from "@workspace/ui/components/motion/text-shimmer"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import { SidebarResizeHandle } from "@workspace/ui/components/sidebar-resize"
import { SidebarSearchField } from "@workspace/ui/components/sidebar-search-field"
import { type Space, spaceAtRank } from "@workspace/ui/components/space"
import {
	SpaceDot,
	SpaceDots,
	SpaceSwitcher,
} from "@workspace/ui/components/space-switcher"
import { TooltipButton } from "@workspace/ui/components/tooltip-button"
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@workspace/ui/components/ui/context-menu"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	useSidebar,
} from "@workspace/ui/components/ui/sidebar"
import {
	UserChip,
	type UserChipIdentity,
} from "@workspace/ui/components/user-chip"
import { useOverlayScrollbars } from "@workspace/ui/hooks/use-overlay-scrollbars"
import {
	dropArea,
	dropAreaAt,
	type Lifter,
	useRosterLift,
} from "@workspace/ui/hooks/use-roster-lift"
import { useSpaceShortcut } from "@workspace/ui/hooks/use-space-shortcut"
import { toPlainText } from "@workspace/ui/lib/plain-text"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"
import { probeRender } from "@workspace/ui/lib/render-probe"
import { cn, mergeRefs } from "@workspace/ui/lib/utils"

const PANEL = "on-shell border-e-0! **:data-[slot=sidebar-inner]:bg-transparent"

const HEADER =
	"h-12 flex-row items-center justify-end py-0 pr-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"

const WINDOW_CONTROLS_INSET = "pl-[78px] group-data-[collapsible=icon]:*:hidden"

const NO_WINDOW_CONTROLS_INSET = "pl-2.5"

const ROW_AVATAR_SIZE = 40

const TIMESTAMP_SLOT =
	"h-5 w-11 shrink-0 truncate text-right text-[11px] text-muted-foreground leading-5 tabular-nums"

const TRAILING_SLOT = "ml-auto flex shrink-0 items-center gap-1.5"

const NAME_LINE = "flex h-5 min-w-0 items-center gap-1.5"

const ROW_STACK = "relative flex h-9 min-w-0 flex-col justify-center"

const ROW_ITEM =
	"flex flex-col gap-1 group-data-[collapsible=icon]:items-center"

const MISSION_STRIPS = "flex flex-col gap-1"

const PREVIEW_LINE =
	"h-4 truncate pe-3.5 text-muted-foreground text-xs leading-4 empty:h-0"

const DESTINATION_NAME = "min-w-0 truncate"

const BRANCH_ROW = "gap-2"

const NAMED_PANEL = `max-w-64 ${STILL_UNDER_REDUCED_MOTION}`

const rowButtonOf = (row: HTMLElement | null) =>
	row?.querySelector<HTMLElement>('[data-slot="sidebar-menu-button"]') ?? null

const sidebarRegionOf = (row: HTMLElement | null) => {
	const region = row?.closest<HTMLElement>('[data-slot="sidebar-content"]')
	if (!region) return null
	region.tabIndex = -1
	return region
}

const LAST_SPACE_NOTE =
	"px-2.5 pt-0.5 pb-1.5 text-[11px] text-muted-foreground leading-[15px]"

const ROW =
	"py-1.5 pl-1.5 aria-expanded:bg-sidebar-accent/70 group-data-[collapsible=icon]:pl-0"

const FOOTER_INSET = "group-data-[collapsible=icon]:px-0"

const FOOTER_ROW =
	"flex flex-row items-center gap-2 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:items-center"

const FOOTER_SLOT = "flex shrink-0 items-center empty:hidden"

const EMPTY_COPY =
	"px-3 py-4 text-center text-sidebar-foreground/70 text-sm group-data-[collapsible=icon]:hidden"

const ROSTER_SURFACE = "min-h-10 flex-1"

const ROSTER_ROWS = "gap-0.5"

const SECTION_GROUP = "px-0 py-0"

const SECTION_PAD = "pb-[4.5px] group-data-[collapsible=icon]:p-0"

const SECTION_CARD =
	"rounded-xl border border-border transition-colors duration-200 ease-out motion-reduce:transition-none has-[[data-slot=roster-section-trigger]:hover]:bg-sidebar-accent/70 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent"

const SECTION_CARD_OPEN =
	"bg-sidebar-accent/50 group-data-[landing]/roster-drop:bg-sidebar-accent"

const SECTION_LABEL =
	"mb-0 h-auto px-0 font-semibold text-sidebar-foreground text-xs normal-case tracking-normal group-data-[collapsible=icon]:hidden"

const SECTION_TRIGGER =
	"flex w-full min-w-0 select-none items-center gap-1.5 rounded-xl px-[10.5px] py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"

const SECTION_NAME = "min-w-0 truncate"

const SECTION_CHEVRON =
	"size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-150 ease-out motion-reduce:transition-none"

const SECTION_BODY =
	"grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:visible group-data-[collapsible=icon]:grid-rows-[1fr]"

const SECTION_BODY_OPEN = "visible grid-rows-[1fr]"

const SECTION_BODY_CLOSED = "invisible grid-rows-[0fr]"

const SECTION_BODY_INNER = "min-h-0 overflow-hidden"

const SECTION_FIELD =
	"w-full min-w-0 border-none bg-transparent px-[10.5px] py-2.5 text-sidebar-foreground text-xs outline-none"

const SECTION_DROP =
	"flex items-center justify-center gap-2 rounded-xl border border-sidebar-border border-dashed px-3 py-3 text-center text-muted-foreground text-xs group-data-[collapsible=icon]:hidden"

const SECTION_DROP_AVATAR = "block opacity-40"

const DROP_AREA =
	"group/roster-drop relative rounded-2xl transition-colors duration-150 ease-out motion-reduce:transition-none"

const DROP_AREA_LANDING = "bg-sidebar-accent/60"

const DROP_AREA_LIFTED =
	"pointer-events-none z-10 origin-top scale-90 bg-sidebar shadow-lg translate-y-[var(--lift-dy,0px)]"

const INSERTION_LINE =
	"pointer-events-none absolute inset-x-2 z-20 h-0.5 rounded-full bg-sidebar-primary"

const PINNED_ZONE_STACK = "flex flex-col gap-1.5"

const ZONE_SEPARATOR =
	"mx-1.5 my-1 block h-px shrink-0 rounded-full bg-sidebar-border group-data-[collapsible=icon]:hidden"

const INSERTION_ABOVE = "-top-0.5"

const INSERTION_BELOW = "-bottom-0.5"

const LIFTED_BOT =
	"pointer-events-none fixed top-0 left-0 z-[100] drop-shadow-lg translate-x-[calc(var(--lift-x,0px)-50%)] translate-y-[calc(var(--lift-y,0px)-50%)]"

const DROP_AVATAR_SIZE = 28

const DROP_POSES: BotAvatarState[] = [
	"thinking",
	"searching",
	"working",
	"writing",
	"listening",
]

const drawnFrom = <Item,>(pool: Item[], seed: string) => {
	const total = [...seed].reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
	return pool[total % pool.length]
}

const CONTENT_INSET = "py-2 ps-2 pe-1 group-data-[collapsible=icon]:px-0"

const SEARCH_INSET = "px-[9px] pb-[9px] group-data-[collapsible=icon]:px-0"

type SidebarSearchSlotProps = { onOpenSearch: () => void }

const SidebarSearchSlot = ({ onOpenSearch }: SidebarSearchSlotProps) => {
	const { isMobile, state } = useSidebar()

	return (
		<div className={SEARCH_INSET}>
			<SidebarSearchField
				isCollapsed={!isMobile && state === "collapsed"}
				onOpen={onOpenSearch}
			/>
		</div>
	)
}

const CLIPPED_SIDEWAYS = { overflow: { x: "hidden" } } as const

const CAROUSEL_CONTENT = "overflow-y-hidden p-0"

const CAROUSEL =
	"flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const CAROUSEL_SWIPEABLE = "overflow-x-auto"

const CAROUSEL_HELD = "overflow-x-hidden"

const CAROUSEL_PANEL =
	"flex w-full flex-none snap-start snap-always flex-col gap-1.5 overflow-y-auto overscroll-y-contain px-[9px] pt-0 pb-1.5 group-data-[collapsible=icon]:px-0"

type AppSidebarStatus = "idle" | "working"

const NO_BOTS: AppSidebarBot[] = []

const NO_CONVERSATIONS: AppSidebarConversation[] = []

const NO_SECTIONS: AppSidebarSection[] = []

const NO_COLLAPSED_SECTIONS: string[] = []

const NO_SECTION = "__none__"

interface AppSidebarSection {
	id: string
	name: string
	position: number
}

interface AppSidebarRowMission {
	id: string
	state: BotMissionState
	ticket: BotMissionTicket
	objective?: string
}

const missionStripsOf = (missions: AppSidebarRowMission[] | undefined) =>
	missions?.length ? (
		<span className={MISSION_STRIPS} data-slot="roster-row-missions">
			{missions.map(({ id, state, ticket, objective }) => (
				<BotMissionStrip
					key={id}
					objective={objective}
					state={state}
					ticket={ticket}
				/>
			))}
		</span>
	) : undefined

interface AppSidebarBot {
	id: string
	name: string
	sectionId?: string | null
	pinPosition?: number | null
	title?: string
	lastMessage?: string
	timestamp?: string
	lastActivityAt?: number
	animal?: BotAvatarAnimal
	blot?: BotAvatarBlot
	image?: string
	status?: AppSidebarStatus
	pose?: ActivityIndicatorKind
	badge?: BotBadge
	missions?: AppSidebarRowMission[]
}

interface AppSidebarConversation {
	id: string
	name: string
	sectionId?: string | null
	pinPosition?: number | null
	participants: AppSidebarBot[]
	lastMessage?: string
	lastSpeaker?: string
	timestamp?: string
	lastActivityAt?: number
	status?: AppSidebarStatus
	badge?: BotBadge
	missions?: AppSidebarRowMission[]
}

const poseOf = (bot: AppSidebarBot) => bot.pose ?? "thinking"

const isBusy = (held: { status?: AppSidebarStatus }) =>
	held.status === "working"

const badgeOf = (conversation: AppSidebarConversation) =>
	conversation.participants.find(
		(participant) => isBusy(participant) && participant.badge,
	)?.badge ?? conversation.badge

const workingBotOf = ({ participants, lastSpeaker }: AppSidebarConversation) =>
	participants.find((bot) => isBusy(bot) && bot.name === lastSpeaker) ??
	participants.find(isBusy)

interface RowPreviewProps {
	isWorking: boolean
	children: ReactNode
}

const RowPreview = ({ isWorking, children }: RowPreviewProps) => (
	<span className={PREVIEW_LINE} data-slot="roster-row-preview">
		{isWorking ? (
			<TextShimmer className="inline" duration={WORKING_SHIMMER_DURATION}>
				{children}
			</TextShimmer>
		) : (
			children
		)}
	</span>
)

const previewOf = (
	t: TFunction<"bots">,
	conversation: AppSidebarConversation,
) => {
	const working = workingBotOf(conversation)
	if (working)
		return t("roster.conversation.preview", {
			name: working.name,
			text: t("roster.working", { pose: t(`roster.pose.${poseOf(working)}`) }),
		})
	if (!conversation.lastMessage) return null
	const text = toPlainText(conversation.lastMessage)
	if (!conversation.lastSpeaker) return text
	return t("roster.conversation.preview", {
		name: conversation.lastSpeaker,
		text,
	})
}

const announcementFor = (
	t: TFunction<"bots">,
	bot?: AppSidebarBot,
	conversation?: AppSidebarConversation,
) => {
	if (conversation)
		return t("roster.announcement.selected", {
			name: conversation.name,
			state: isBusy(conversation) ? t("roster.pose.working") : t("roster.idle"),
		})
	if (!bot) return t("roster.announcement.none")
	return t("roster.announcement.selected", {
		name: bot.name,
		state: isBusy(bot) ? t(`roster.pose.${poseOf(bot)}`) : t("roster.idle"),
	})
}

interface BotRosterActions {
	onSelectBot?: (id: string) => void
	onEditBot?: (id: string) => void
	onDuplicateBot?: (id: string) => void
	onAddBotToSpace?: (botId: string, spaceId: string) => void
	onRemoveBotFromSpace?: (botId: string, spaceId: string) => void
	onDeleteBot?: (id: string) => void
}

interface SectionNaming {
	rowId: string | null
}

interface RosterCreateActions {
	onCreateBot?: () => void
	onCreateConversation?: () => void
}

interface RosterSpaceActions {
	onOpenSpaceSettings?: () => void
}

interface RosterPin {
	id: string
	sectionId: string | null
}

interface SectionActions {
	onCreateSection?: (name: string, rowId?: string) => void
	onRenameSection?: (id: string, name: string) => void
	onDeleteSection?: (id: string) => void
	onCollapseSection?: (id: string, isCollapsed: boolean) => void
	onPinRoster?: (spaceId: string, pins: RosterPin[]) => void
}

interface SectionBranchProps {
	id: string
	sectionId?: string | null
	sections: AppSidebarSection[]
	onMoveToSection?: (id: string, sectionId: string | null) => void
	onCreateSectionFor?: (id: string) => void
}

const SectionBranch = ({
	id,
	sectionId,
	sections,
	onMoveToSection,
	onCreateSectionFor,
}: SectionBranchProps) => {
	const { t } = useTranslation("bots")

	if (!onMoveToSection && !onCreateSectionFor) return null

	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger className={BRANCH_ROW}>
				<Icons.Folder aria-hidden="true" className="size-3.5" />
				{t("roster.section.moveTo")}
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className={NAMED_PANEL}>
				<ContextMenuRadioGroup
					onValueChange={(value) =>
						onMoveToSection?.(id, value === NO_SECTION ? null : value)
					}
					value={sectionId ?? NO_SECTION}
				>
					<ContextMenuRadioItem
						closeOnClick
						label={t("roster.section.none")}
						value={NO_SECTION}
					>
						<span className={DESTINATION_NAME}>{t("roster.section.none")}</span>
					</ContextMenuRadioItem>
					{sections.map((section) => (
						<ContextMenuRadioItem
							closeOnClick
							key={section.id}
							label={section.name}
							value={section.id}
						>
							<span className={DESTINATION_NAME}>{section.name}</span>
						</ContextMenuRadioItem>
					))}
				</ContextMenuRadioGroup>
				{onCreateSectionFor ? (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem
							label={t("roster.section.create")}
							onClick={() => onCreateSectionFor(id)}
						>
							<Icons.Add aria-hidden="true" className="size-3.5" />
							{t("roster.section.create")}
						</ContextMenuItem>
					</>
				) : null}
			</ContextMenuSubContent>
		</ContextMenuSub>
	)
}

interface BotMembershipQuery {
	botId: string
	botsBySpaceId?: Record<string, AppSidebarBot[]>
}

const spaceIdsOfBot = ({
	botId,
	botsBySpaceId,
}: BotMembershipQuery): string[] => {
	if (!botsBySpaceId) return []
	return Object.entries(botsBySpaceId)
		.filter(([, held]) => held.some((bot) => bot.id === botId))
		.map(([spaceId]) => spaceId)
}

interface SpacesBranchProps {
	botId: string
	spaces: Space[]
	memberships: string[]
	openSpaceId?: string
	onAddToSpace?: (botId: string, spaceId: string) => void
	onRemoveFromSpace?: (botId: string, spaceId: string) => void
}

const SpacesBranch = ({
	botId,
	spaces,
	memberships,
	openSpaceId,
	onAddToSpace,
	onRemoveFromSpace,
}: SpacesBranchProps) => {
	const { t } = useTranslation("bots")
	const reasonId = useId()

	const hasHost = Boolean(onAddToSpace || onRemoveFromSpace)

	if (!hasHost || spaces.length === 0 || memberships.length === 0) return null

	const isHeldByOneSpace = memberships.length === 1
	const reason = t("roster.spaces.lastSpace")

	return (
		<ContextMenuSub>
			{isHeldByOneSpace ? (
				<span className="sr-only" id={reasonId}>
					{reason}
				</span>
			) : null}
			<ContextMenuSubTrigger
				aria-describedby={isHeldByOneSpace ? reasonId : undefined}
				className={BRANCH_ROW}
			>
				<Icons.Spaces aria-hidden="true" className="size-3.5" />
				{t("roster.spaces.label")}
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className={NAMED_PANEL}>
				{spaces.map((space) => {
					const isMember = memberships.includes(space.id)
					const isLocked = isMember && isHeldByOneSpace
					return (
						<ContextMenuCheckboxItem
							aria-describedby={isLocked ? reasonId : undefined}
							checked={isMember}
							closeOnClick={isMember && space.id === openSpaceId}
							disabled={isLocked}
							key={space.id}
							label={space.name}
							onCheckedChange={(checked) =>
								checked
									? onAddToSpace?.(botId, space.id)
									: onRemoveFromSpace?.(botId, space.id)
							}
						>
							<SpaceDot colour={space.colour} />
							<span className={DESTINATION_NAME}>{space.name}</span>
						</ContextMenuCheckboxItem>
					)
				})}
				{isHeldByOneSpace ? (
					<>
						<ContextMenuSeparator />
						<p aria-hidden="true" className={LAST_SPACE_NOTE}>
							{reason}
						</p>
					</>
				) : null}
			</ContextMenuSubContent>
		</ContextMenuSub>
	)
}

const useRosterBadgePlacement = (badge?: BotBadge) => {
	const { state } = useSidebar()
	const isCollapsed = state === "collapsed"

	return {
		isCollapsed,
		avatarBadge: isCollapsed ? badge : undefined,
		rowBadge: isCollapsed ? undefined : badge,
	}
}

interface BotRowAvatarProps {
	bot: AppSidebarBot
	badge?: BotBadge
}

const BotRowAvatar = ({ bot, badge }: BotRowAvatarProps) => (
	<BotIdentityAvatar
		animal={bot.animal}
		badge={badge}
		blot={bot.blot}
		image={bot.image}
		kind={poseOf(bot)}
		name={bot.name}
		seed={bot.id}
		size={ROW_AVATAR_SIZE}
		working={isBusy(bot)}
	/>
)

type InsertionEdge = "above" | "below"

interface InsertionLineProps {
	edge?: InsertionEdge
}

const InsertionLine = ({ edge }: InsertionLineProps) =>
	edge ? (
		<span
			className={cn(
				INSERTION_LINE,
				edge === "above" ? INSERTION_ABOVE : INSERTION_BELOW,
			)}
			data-slot="roster-insertion"
		/>
	) : null

const RosterZoneSeparator = () => (
	<span
		aria-hidden="true"
		className={ZONE_SEPARATOR}
		data-slot="roster-zone-separator"
	/>
)

interface PinGroupProps extends RosterPinActions {
	id: string
	isPinned: boolean
}

const PinGroup = ({ id, isPinned, onPin, onUnpin }: PinGroupProps) => {
	const { t } = useTranslation("bots")

	const toggle = isPinned ? onUnpin : onPin
	if (!toggle) return null

	const PinIcon = isPinned ? Icons.Unpin : Icons.Pin
	return (
		<>
			<ContextMenuItem onClick={() => toggle(id)}>
				<PinIcon aria-hidden="true" className="size-3.5" />
				{t(isPinned ? "roster.unpin" : "roster.pin")}
			</ContextMenuItem>
			<ContextMenuSeparator />
		</>
	)
}

interface RosterRowSlot {
	insertion?: InsertionEdge
	isPinned: boolean
	slotRef?: (node: HTMLElement | null) => void
}

interface RosterPinActions {
	onPin?: (id: string) => void
	onUnpin?: (id: string) => void
}

interface BotRosterRowProps extends RosterRowSlot, RosterPinActions {
	bot: AppSidebarBot
	isSelected: boolean
	spaces: Space[]
	memberships: string[]
	sections: AppSidebarSection[]
	openSpaceId?: string
	onSelect?: (id: string) => void
	onEdit?: (id: string) => void
	onDuplicate?: (id: string) => void
	onAddToSpace?: (botId: string, spaceId: string) => void
	onRemoveFromSpace?: (botId: string, spaceId: string) => void
	onDelete?: (id: string) => void
	onMoveToSection?: (id: string, sectionId: string | null) => void
	onCreateSectionFor?: (id: string) => void
	lift: Lifter
}

const BotRosterRow = ({
	bot,
	isSelected,
	spaces,
	memberships,
	sections,
	openSpaceId,
	lift,
	insertion,
	slotRef,
	isPinned,
	onPin,
	onUnpin,
	onSelect,
	onEdit,
	onDuplicate,
	onAddToSpace,
	onRemoveFromSpace,
	onDelete,
	onMoveToSection,
	onCreateSectionFor,
}: BotRosterRowProps) => {
	const { t } = useTranslation("bots")
	const pose = poseOf(bot)
	const working = isBusy(bot)
	const { isCollapsed, avatarBadge, rowBadge } = useRosterBadgePlacement(
		bot.badge,
	)
	const strips = isCollapsed ? undefined : missionStripsOf(bot.missions)
	const rowRef = useRef<HTMLElement | null>(null)

	const focusAfterClose = useRef<HTMLElement | null>(null)

	const leaveSpace = (botId: string, spaceId: string) => {
		focusAfterClose.current =
			spaceId === openSpaceId ? sidebarRegionOf(rowRef.current) : null
		onRemoveFromSpace?.(botId, spaceId)
	}

	const keepFocusAfterClose = () =>
		focusAfterClose.current ?? rowButtonOf(rowRef.current) ?? true

	return (
		<SidebarMenuItem
			{...(isPinned ? dropArea(bot.id) : undefined)}
			className={ROW_ITEM}
			data-tauri-drag-region="false"
			ref={mergeRefs<HTMLElement>(rowRef, slotRef)}
		>
			<InsertionLine edge={insertion} />
			<ContextMenu>
				<ContextMenuTrigger>
					<SidebarMenuRow
						{...lift.handlersFor(bot.id)}
						below={strips}
						className={ROW}
						icon={<BotRowAvatar badge={avatarBadge} bot={bot} />}
						isActive={isSelected}
						isIconDecorative={false}
						label={bot.name}
						onSelect={() => {
							if (lift.hasJustDropped()) return
							onSelect?.(bot.id)
						}}
					>
						<span className={ROW_STACK}>
							<span className={NAME_LINE}>
								<span className="truncate" data-slot="roster-row-name">
									{bot.name}
								</span>
								<BotTitleBadge
									className="max-w-16"
									data-slot="roster-row-badge"
									title={bot.title}
								/>
								<span className={TRAILING_SLOT}>
									<span
										className={TIMESTAMP_SLOT}
										data-slot="roster-row-timestamp"
									>
										{bot.timestamp}
									</span>
								</span>
							</span>
							<RowPreview isWorking={working}>
								{working
									? t("roster.working", { pose: t(`roster.pose.${pose}`) })
									: bot.lastMessage && toPlainText(bot.lastMessage)}
							</RowPreview>
							{rowBadge ? (
								<BotBadgeDot
									badge={rowBadge}
									data-slot="bot-activity-dot"
									placement="row"
								/>
							) : null}
						</span>
					</SidebarMenuRow>
				</ContextMenuTrigger>
				<ContextMenuContent
					aria-label={t("roster.actions", { name: bot.name })}
					className={STILL_UNDER_REDUCED_MOTION}
					finalFocus={keepFocusAfterClose}
				>
					<PinGroup
						id={bot.id}
						isPinned={isPinned}
						onPin={onPin}
						onUnpin={onUnpin}
					/>
					<ContextMenuItem onClick={() => onEdit?.(bot.id)}>
						<Icons.Settings aria-hidden="true" className="size-3.5" />
						{t("roster.settings")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => onDuplicate?.(bot.id)}>
						<Icons.Copy aria-hidden="true" className="size-3.5" />
						{t("roster.duplicate")}
					</ContextMenuItem>
					<SectionBranch
						id={bot.id}
						onCreateSectionFor={onCreateSectionFor}
						onMoveToSection={onMoveToSection}
						sectionId={bot.sectionId}
						sections={sections}
					/>
					<SpacesBranch
						botId={bot.id}
						memberships={memberships}
						onAddToSpace={onAddToSpace}
						onRemoveFromSpace={leaveSpace}
						openSpaceId={openSpaceId}
						spaces={spaces}
					/>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={() => onDelete?.(bot.id)}
						variant="destructive"
					>
						<Icons.Delete aria-hidden="true" className="size-3.5" />
						{t("roster.delete")}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</SidebarMenuItem>
	)
}

const heldBotsOf = (
	conversation: AppSidebarConversation,
): ConversationParticipant[] =>
	conversation.participants.map((participant) => ({
		...participant,
		kind: poseOf(participant),
		working: isBusy(participant),
	}))

interface ConversationRosterActions {
	onSelectConversation?: (id: string) => void
	onOpenConversationSettings?: (id: string) => void
	onDeleteConversation?: (id: string) => void
}

interface ConversationRosterRowProps extends RosterRowSlot, RosterPinActions {
	conversation: AppSidebarConversation
	isSelected: boolean
	sections: AppSidebarSection[]
	onSelect?: (id: string) => void
	onOpenSettings?: (id: string) => void
	onDelete?: (id: string) => void
	onMoveToSection?: (id: string, sectionId: string | null) => void
	onCreateSectionFor?: (id: string) => void
	lift: Lifter
}

const ConversationRosterRow = ({
	conversation,
	isSelected,
	sections,
	lift,
	insertion,
	slotRef,
	isPinned,
	onPin,
	onUnpin,
	onSelect,
	onOpenSettings,
	onDelete,
	onMoveToSection,
	onCreateSectionFor,
}: ConversationRosterRowProps) => {
	const { t } = useTranslation("bots")
	const { isCollapsed, avatarBadge, rowBadge } = useRosterBadgePlacement(
		badgeOf(conversation),
	)
	const strips = isCollapsed
		? undefined
		: missionStripsOf(conversation.missions)

	return (
		<SidebarMenuItem
			{...(isPinned ? dropArea(conversation.id) : undefined)}
			className={ROW_ITEM}
			data-tauri-drag-region="false"
			ref={slotRef}
		>
			<InsertionLine edge={insertion} />
			<ContextMenu>
				<ContextMenuTrigger>
					<SidebarMenuRow
						{...lift.handlersFor(conversation.id)}
						below={strips}
						className={ROW}
						icon={
							<AvatarGroup
								badge={avatarBadge}
								participants={heldBotsOf(conversation)}
								size={ROW_AVATAR_SIZE}
							/>
						}
						isActive={isSelected}
						isIconDecorative={false}
						label={conversation.name}
						onSelect={() => {
							if (lift.hasJustDropped()) return
							onSelect?.(conversation.id)
						}}
					>
						<span className={ROW_STACK}>
							<span className={NAME_LINE}>
								<span className="truncate" data-slot="roster-row-name">
									{conversation.name}
								</span>
								<span className={TRAILING_SLOT}>
									<span
										className={TIMESTAMP_SLOT}
										data-slot="roster-row-timestamp"
									>
										{conversation.timestamp}
									</span>
								</span>
							</span>
							<RowPreview isWorking={Boolean(workingBotOf(conversation))}>
								{previewOf(t, conversation)}
							</RowPreview>
							{rowBadge ? (
								<BotBadgeDot
									badge={rowBadge}
									data-slot="bot-activity-dot"
									placement="row"
								/>
							) : null}
						</span>
					</SidebarMenuRow>
				</ContextMenuTrigger>
				<ContextMenuContent
					aria-label={t("roster.actions", { name: conversation.name })}
					className={STILL_UNDER_REDUCED_MOTION}
				>
					<PinGroup
						id={conversation.id}
						isPinned={isPinned}
						onPin={onPin}
						onUnpin={onUnpin}
					/>
					<ContextMenuItem onClick={() => onOpenSettings?.(conversation.id)}>
						<Icons.Settings aria-hidden="true" className="size-3.5" />
						{t("roster.settings")}
					</ContextMenuItem>
					<SectionBranch
						id={conversation.id}
						onCreateSectionFor={onCreateSectionFor}
						onMoveToSection={onMoveToSection}
						sectionId={conversation.sectionId}
						sections={sections}
					/>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={() => onDelete?.(conversation.id)}
						variant="destructive"
					>
						<Icons.Delete aria-hidden="true" className="size-3.5" />
						{t("roster.delete")}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</SidebarMenuItem>
	)
}

interface CreateItemsProps {
	onCreateBot?: () => void
	onCreateConversation?: () => void
	onCreateSection?: () => void
}

const CreateItems = ({
	onCreateBot,
	onCreateConversation,
	onCreateSection,
}: CreateItemsProps) => {
	const { t } = useTranslation("bots")

	return (
		<>
			{onCreateBot ? (
				<ContextMenuItem onClick={onCreateBot}>
					<Icons.User aria-hidden="true" className="size-3.5" />
					{t("roster.create")}
				</ContextMenuItem>
			) : null}
			{onCreateConversation ? (
				<ContextMenuItem onClick={onCreateConversation}>
					<Icons.Message aria-hidden="true" className="size-3.5" />
					{t("roster.conversation.create")}
				</ContextMenuItem>
			) : null}
			{onCreateSection ? (
				<ContextMenuItem onClick={onCreateSection}>
					<Icons.Folder aria-hidden="true" className="size-3.5" />
					{t("roster.section.create")}
				</ContextMenuItem>
			) : null}
		</>
	)
}

interface RosterSurfaceProps extends CreateItemsProps, RosterSpaceActions {
	children?: ReactNode
}

const RosterSurface = ({
	onCreateBot,
	onCreateConversation,
	onCreateSection,
	onOpenSpaceSettings,
	children,
}: RosterSurfaceProps) => {
	const { t } = useTranslation("bots")

	if (!onCreateBot && !onCreateConversation && !onCreateSection)
		return <>{children}</>

	return (
		<ContextMenu>
			<ContextMenuTrigger className={ROSTER_SURFACE} data-slot="roster-surface">
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent
				aria-label={t("roster.createMenu")}
				className={STILL_UNDER_REDUCED_MOTION}
			>
				<CreateItems
					onCreateBot={onCreateBot}
					onCreateConversation={onCreateConversation}
					onCreateSection={onCreateSection}
				/>
				{onOpenSpaceSettings ? (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={onOpenSpaceSettings}>
							<Icons.Settings aria-hidden="true" className="size-3.5" />
							{t("spaces.settings")}
						</ContextMenuItem>
					</>
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}

interface SectionLabelProps {
	ref?: (node: HTMLElement | null) => void
	children: ReactNode
}

const SectionLabel = ({ ref, children }: SectionLabelProps) => (
	<SidebarGroupLabel className={SECTION_LABEL} ref={ref}>
		{children}
	</SidebarGroupLabel>
)

interface SectionDropZoneProps {
	name: string
	label?: string
}

const SectionDropZone = ({ name, label }: SectionDropZoneProps) => {
	const { t } = useTranslation("bots")

	return (
		<div className={SECTION_DROP} data-slot="roster-section-drop">
			<span aria-hidden="true" className={SECTION_DROP_AVATAR}>
				<BotAvatar
					animal={drawnFrom(BOT_IDENTITY_ANIMALS, name)}
					animated={false}
					size={DROP_AVATAR_SIZE}
					state={drawnFrom(DROP_POSES, name)}
				/>
			</span>
			{label ?? t("roster.section.empty")}
		</div>
	)
}

interface RosterDropAreaProps {
	landing: string
	isLanding: boolean
	isLifted?: boolean
	insertion?: InsertionEdge
	className?: string
	ref?: (node: HTMLElement | null) => void
	children: ReactNode
}

const RosterDropArea = ({
	landing,
	isLanding,
	isLifted = false,
	insertion,
	className,
	ref,
	children,
}: RosterDropAreaProps) => (
	<div
		{...dropArea(landing)}
		className={cn(
			DROP_AREA,
			isLanding && DROP_AREA_LANDING,
			isLifted && DROP_AREA_LIFTED,
			className,
		)}
		data-landing={isLanding || undefined}
		data-slot="roster-drop-area"
		data-tauri-drag-region="false"
		ref={ref}
	>
		<InsertionLine edge={insertion} />
		{children}
	</div>
)

interface LiftedRowProps {
	bot?: AppSidebarBot
	conversation?: AppSidebarConversation
	ref: (node: HTMLElement | null) => void
}

const LiftedRow = ({ bot, conversation, ref }: LiftedRowProps) => (
	<span
		aria-hidden="true"
		className={LIFTED_BOT}
		data-slot="roster-lifted-bot"
		ref={ref}
	>
		{conversation ? (
			<AvatarGroup
				participants={heldBotsOf(conversation)}
				size={ROW_AVATAR_SIZE}
			/>
		) : null}
		{bot ? <BotRowAvatar bot={bot} /> : null}
	</span>
)

interface SectionNameFieldProps {
	ariaLabel: string
	initialName: string
	onCommit: (name: string) => void
	onCancel: () => void
}

const SectionNameField = ({
	ariaLabel,
	initialName,
	onCommit,
	onCancel,
}: SectionNameFieldProps) => {
	const [draft, setDraft] = useState(initialName)
	const isSettled = useRef(false)
	const selectAll = useCallback((node: HTMLInputElement | null) => {
		node?.select()
	}, [])

	const settle = () => {
		if (isSettled.current) return
		isSettled.current = true
		const named = draft.trim()
		if (named) onCommit(named)
		else onCancel()
	}

	const abandon = () => {
		isSettled.current = true
		onCancel()
	}

	return (
		<input
			aria-label={ariaLabel}
			className={SECTION_FIELD}
			data-slot="roster-section-field"
			onBlur={settle}
			onChange={(event) => setDraft(event.target.value)}
			onKeyDown={(event) => {
				event.stopPropagation()
				if (event.key === "Enter") settle()
				if (event.key === "Escape") abandon()
			}}
			ref={selectAll}
			value={draft}
		/>
	)
}

interface RosterSectionProps {
	section: AppSidebarSection
	isFirst: boolean
	isLast: boolean
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	onRename?: (id: string, name: string) => void
	onMove?: (id: string, by: number) => void
	onDelete?: (id: string) => void
	lift: Lifter
	headRef?: (node: HTMLElement | null) => void
	children: ReactNode
}

const RosterSection = ({
	section,
	isFirst,
	isLast,
	isOpen,
	onOpenChange,
	lift,
	headRef,
	onRename,
	onMove,
	onDelete,
	children,
}: RosterSectionProps) => {
	const { t } = useTranslation("bots")
	const bodyId = useId()
	const [isRenaming, setIsRenaming] = useState(false)

	return (
		<SidebarGroup
			className={cn(SECTION_GROUP, SECTION_CARD, isOpen && SECTION_CARD_OPEN)}
		>
			<SectionLabel ref={headRef}>
				{isRenaming ? (
					<SectionNameField
						ariaLabel={t("roster.section.renameField", { name: section.name })}
						initialName={section.name}
						onCancel={() => setIsRenaming(false)}
						onCommit={(name) => {
							setIsRenaming(false)
							onRename?.(section.id, name)
						}}
					/>
				) : (
					<ContextMenu>
						<ContextMenuTrigger
							render={
								<button
									{...lift.handlersFor(section.id)}
									aria-controls={bodyId}
									aria-expanded={isOpen}
									className={SECTION_TRIGGER}
									data-slot="roster-section-trigger"
									onClick={() => {
										if (lift.hasJustDropped()) return
										onOpenChange(!isOpen)
									}}
									type="button"
								>
									<span
										className={SECTION_NAME}
										data-slot="roster-section-name"
									>
										{section.name}
									</span>
									<Icons.Next
										aria-hidden="true"
										className={cn(SECTION_CHEVRON, isOpen && "rotate-90")}
									/>
								</button>
							}
						/>
						<ContextMenuContent
							aria-label={t("roster.section.actions", { name: section.name })}
							className={STILL_UNDER_REDUCED_MOTION}
						>
							<ContextMenuItem onClick={() => setIsRenaming(true)}>
								<Icons.Edit aria-hidden="true" className="size-3.5" />
								{t("roster.section.rename")}
							</ContextMenuItem>
							<ContextMenuItem
								disabled={isFirst}
								onClick={() => onMove?.(section.id, -1)}
							>
								<Icons.ArrowUp aria-hidden="true" className="size-3.5" />
								{t("roster.section.moveUp")}
							</ContextMenuItem>
							<ContextMenuItem
								disabled={isLast}
								onClick={() => onMove?.(section.id, 1)}
							>
								<Icons.ArrowDown aria-hidden="true" className="size-3.5" />
								{t("roster.section.moveDown")}
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() => onDelete?.(section.id)}
								variant="destructive"
							>
								<Icons.Delete aria-hidden="true" className="size-3.5" />
								{t("roster.section.delete")}
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				)}
			</SectionLabel>
			<SidebarGroupContent
				className={cn(
					SECTION_BODY,
					isOpen ? SECTION_BODY_OPEN : SECTION_BODY_CLOSED,
				)}
				id={bodyId}
			>
				<div className={SECTION_BODY_INNER}>
					<div className={SECTION_PAD}>{children}</div>
				</div>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}

interface RosterRow {
	id: string
	sectionId?: string | null
	pinPosition?: number | null
}

const sectionOf = (held: RosterRow, known: Set<string>) =>
	held.sectionId && known.has(held.sectionId) ? held.sectionId : null

const pinOf = (held: RosterRow) => held.pinPosition ?? null

const SORTED_ZONE = "__sorted__"

const PINNED_ZONE = "__pinned__"

const SORTED = "sorted"

type Landing = typeof SORTED | { at: number; holder: string | null }

const isSameLanding = (one: Landing | null, other: Landing | null) => {
	if (one === other) return true
	if (one === null || other === null || one === SORTED || other === SORTED)
		return false
	return one.at === other.at && one.holder === other.holder
}

interface PinnedEntry {
	id: string
	sectionId: string | null
	rank: number
	section?: AppSidebarSection
	bot?: AppSidebarBot
	conversation?: AppSidebarConversation
}

const byRank = (one: PinnedEntry, other: PinnedEntry) => one.rank - other.rank

const NO_ACTIVITY = -1

const activityOf = ({ bot, conversation }: PinnedEntry) =>
	bot?.lastActivityAt ?? conversation?.lastActivityAt ?? NO_ACTIVITY

const byMostRecent = (one: PinnedEntry, other: PinnedEntry) =>
	activityOf(other) - activityOf(one)

const hasWaitingMission = (missions: AppSidebarRowMission[] | undefined) =>
	missions?.some(({ state }) => state === "waiting") ?? false

const isWaitingOnReader = ({ bot, conversation }: PinnedEntry) =>
	hasWaitingMission(bot?.missions) || hasWaitingMission(conversation?.missions)

const waitingFirst = (entries: PinnedEntry[]) => [
	...entries.filter(isWaitingOnReader),
	...entries.filter((entry) => !isWaitingOnReader(entry)),
]

const toPin = ({ id, sectionId }: PinnedEntry): RosterPin => ({ id, sectionId })

const botEntry = (
	bot: AppSidebarBot,
	sectionId: string | null = null,
): PinnedEntry => ({ id: bot.id, sectionId, rank: pinOf(bot) ?? 0, bot })

const conversationEntry = (
	conversation: AppSidebarConversation,
	sectionId: string | null = null,
): PinnedEntry => ({
	id: conversation.id,
	sectionId,
	rank: pinOf(conversation) ?? 0,
	conversation,
})

const inRuns = (entries: PinnedEntry[]) =>
	entries.reduce<PinnedEntry[][]>((runs, entry) => {
		const last = runs.at(-1)
		if (last && !entry.section && !last[0].section) last.push(entry)
		else runs.push([entry])
		return runs
	}, [])

const endOfSection = (entries: PinnedEntry[], sectionId: string) => {
	const head = entries.findIndex((entry) => entry.section?.id === sectionId)
	if (head < 0) return head
	let at = head + 1
	while (entries[at]?.sectionId === sectionId) at += 1
	return at
}

interface BotRosterProps
	extends BotRosterActions,
		ConversationRosterActions,
		SectionActions,
		RosterCreateActions,
		RosterSpaceActions {
	spaceId?: string
	bots: AppSidebarBot[]
	haveBotsFailedToLoad?: boolean
	conversations: AppSidebarConversation[]
	selectedBotId?: string
	selectedConversationId?: string
	spaces: Space[]
	membershipsOf: (botId: string) => string[]
	sections: AppSidebarSection[]
	collapsedSectionIds?: string[]
	naming?: SectionNaming | null
	onNaming?: (naming: SectionNaming | null) => void
}

const BotRoster = ({
	spaceId,
	bots,
	haveBotsFailedToLoad = false,
	conversations,
	selectedBotId,
	selectedConversationId,
	spaces,
	membershipsOf,
	sections,
	collapsedSectionIds = NO_COLLAPSED_SECTIONS,
	onCollapseSection,
	naming = null,
	onNaming,
	onCreateBot,
	onCreateConversation,
	onOpenSpaceSettings,
	onSelectConversation,
	onOpenConversationSettings,
	onDeleteConversation,
	onSelectBot,
	onEditBot,
	onDuplicateBot,
	onAddBotToSpace,
	onRemoveBotFromSpace,
	onDeleteBot,
	onCreateSection,
	onRenameSection,
	onDeleteSection,
	onPinRoster,
}: BotRosterProps) => {
	const { t } = useTranslation("bots")
	const { isMobile, state } = useSidebar()

	const known = new Set(sections.map((section) => section.id))

	const activeBotId = selectedConversationId ? undefined : selectedBotId

	const isNamed = (id: string) => id === naming?.rowId

	const nameSectionFor = (rowId: string) => onNaming?.({ rowId })

	const nameLooseSection = () => onNaming?.({ rowId: null })

	const stopNaming = () => onNaming?.(null)

	const isHeldBy = (held: RosterRow, sectionId: string | null) =>
		!isNamed(held.id) &&
		pinOf(held) !== null &&
		sectionOf(held, known) === sectionId

	const rowsOf = (sectionId: string | null): PinnedEntry[] =>
		[
			...conversations
				.filter((conversation) => isHeldBy(conversation, sectionId))
				.map((conversation) => conversationEntry(conversation, sectionId)),
			...bots
				.filter((bot) => isHeldBy(bot, sectionId))
				.map((bot) => botEntry(bot, sectionId)),
		].toSorted(byRank)

	const topLevel = [
		...sections.map((section) => ({
			id: section.id,
			sectionId: null,
			rank: section.position,
			section,
		})),
		...rowsOf(null),
	].toSorted(byRank)

	const flatten = (entries: PinnedEntry[]) =>
		entries.flatMap((entry) =>
			entry.section ? [entry, ...rowsOf(entry.section.id)] : [entry],
		)

	const pinnedEntries = flatten(topLevel)

	const isSorted = (held: RosterRow) =>
		!isNamed(held.id) && pinOf(held) === null

	const sortedConversations = conversations.filter(isSorted)
	const sortedBots = bots.filter(isSorted)

	const looseEntry = (id: string): PinnedEntry | undefined => {
		const bot = bots.find((held) => held.id === id)
		if (bot) return botEntry(bot)
		const conversation = conversations.find((held) => held.id === id)
		return conversation ? conversationEntry(conversation) : undefined
	}

	const blockOf = (id: string): PinnedEntry[] => {
		const held = pinnedEntries.find((entry) => entry.id === id)
		if (!held) {
			const loose = looseEntry(id)
			return loose ? [loose] : []
		}
		return held.section ? [held, ...rowsOf(held.section.id)] : [held]
	}

	const withoutBlock = (id: string) => {
		const moving = new Set(blockOf(id).map((entry) => entry.id))
		return pinnedEntries.filter((entry) => !moving.has(entry.id))
	}

	const standsAlready = (entries: PinnedEntry[]) =>
		entries.length === pinnedEntries.length &&
		entries.every(
			(entry, rank) =>
				entry.id === pinnedEntries[rank]?.id &&
				entry.sectionId === pinnedEntries[rank]?.sectionId,
		)

	const pin = (entries: PinnedEntry[]) => {
		if (!spaceId || standsAlready(entries)) return
		onPinRoster?.(spaceId, entries.map(toPin))
	}

	const slots = useRef(new Map<string, HTMLElement>()).current

	const cards = useRef(new Map<string, HTMLElement>()).current

	const keeping =
		(held: Map<string, HTMLElement>) =>
		(id: string) =>
		(node: HTMLElement | null) => {
			if (node) held.set(id, node)
			else held.delete(id)
		}

	const slotFor = keeping(slots)

	const cardFor = keeping(cards)

	const middleIn = (held: Map<string, HTMLElement>, id: string) => {
		const box = held.get(id)?.getBoundingClientRect()
		return box ? box.top + box.height / 2 : Number.POSITIVE_INFINITY
	}

	const isSectionLift = (id: string) =>
		Boolean(topLevel.find((entry) => entry.id === id)?.section)

	const topLevelWithout = (id: string) =>
		topLevel.filter((entry) => entry.id !== id)

	const holderOf = (area: string) => {
		if (known.has(area)) return area
		return pinnedEntries.find((entry) => entry.id === area)?.sectionId ?? null
	}

	const landingAt = (x: number, y: number, id: string): Landing | null => {
		const area = dropAreaAt(x, y)
		if (area === null) return null
		if (area === SORTED_ZONE) return SORTED
		if (isSectionLift(id))
			return {
				at: topLevelWithout(id).filter((entry) => middleIn(cards, entry.id) < y)
					.length,
				holder: null,
			}
		return {
			at: withoutBlock(id).filter((entry) => middleIn(slots, entry.id) < y)
				.length,
			holder: holderOf(area),
		}
	}

	const placeSection = (id: string, at: number) => {
		const held = topLevel.find((entry) => entry.id === id)
		if (!held) return
		const rest = topLevel.filter((entry) => entry.id !== id)
		pin(flatten([...rest.slice(0, at), held, ...rest.slice(at)]))
	}

	const land = (id: string, landing: Landing) => {
		const moving = blockOf(id)
		const lifted = moving[0]
		if (!lifted) return
		if (landing === SORTED) {
			pin(withoutBlock(id))
			return
		}
		if (lifted.section) {
			placeSection(id, landing.at)
			return
		}
		const rest = withoutBlock(id)
		pin([
			...rest.slice(0, landing.at),
			{ ...lifted, sectionId: landing.holder },
			...rest.slice(landing.at),
		])
	}

	const pinLast = (id: string) => {
		const row = looseEntry(id)
		if (row) pin([...withoutBlock(id), { ...row, sectionId: null }])
	}

	const unpin = (id: string) => pin(withoutBlock(id))

	const fileRow = (id: string, sectionId: string | null) => {
		if (sectionId === null) {
			unpin(id)
			return
		}
		const row = looseEntry(id)
		const rest = withoutBlock(id)
		const at = endOfSection(rest, sectionId)
		if (!row || at < 0) return
		pin([...rest.slice(0, at), { ...row, sectionId }, ...rest.slice(at)])
	}

	const moveSection = (id: string, by: number) => {
		const at = topLevel.findIndex((entry) => entry.id === id) + by
		if (at < 0 || at >= topLevel.length) return
		placeSection(id, at)
	}

	const rosterLift = useRosterLift({
		isEnabled: isMobile || state === "expanded",
		isSameLanding,
		landingAt,
		onLand: land,
	})

	const liftedId = rosterLift.lift?.id
	const liftedEntry = liftedId ? blockOf(liftedId)[0] : undefined
	const liftedSectionId = liftedEntry?.section?.id
	const held = rosterLift.lift?.landing ?? null
	const insertion = held === null || held === SORTED ? null : held
	const placedUnderLift = !liftedId
		? pinnedEntries
		: liftedSectionId
			? topLevelWithout(liftedId)
			: withoutBlock(liftedId)

	const landingSection = liftedSectionId ? null : (insertion?.holder ?? null)

	const holds = (entry: PinnedEntry | undefined, holder: string | null) =>
		entry !== undefined &&
		(entry.section ? holder === null : entry.sectionId === holder)

	const insertionMark = () => {
		if (!insertion) return null
		const { at, holder } = insertion
		if (holds(placedUnderLift[at], holder))
			return { id: placedUnderLift[at].id, edge: "above" as const }
		for (let rank = at - 1; rank >= 0; rank -= 1) {
			const above = placedUnderLift[rank]
			if (holds(above, holder)) return { id: above.id, edge: "below" as const }
		}
		return null
	}

	const mark = insertionMark()

	const edgeAt = (id: string): InsertionEdge | undefined =>
		mark?.id === id ? mark.edge : undefined

	const rowFor = (entry: PinnedEntry, isSlotted: boolean) => {
		const shared = {
			insertion: isSlotted ? edgeAt(entry.id) : undefined,
			isPinned: isSlotted,
			lift: rosterLift,
			onCreateSectionFor: onCreateSection ? nameSectionFor : undefined,
			onMoveToSection: onPinRoster && sections.length > 0 ? fileRow : undefined,
			onPin: onPinRoster ? pinLast : undefined,
			onUnpin: onPinRoster ? unpin : undefined,
			sections,
			slotRef: isSlotted ? slotFor(entry.id) : undefined,
		}
		if (entry.conversation)
			return (
				<ConversationRosterRow
					{...shared}
					conversation={entry.conversation}
					isSelected={entry.conversation.id === selectedConversationId}
					key={entry.id}
					onDelete={onDeleteConversation}
					onOpenSettings={onOpenConversationSettings}
					onSelect={onSelectConversation}
				/>
			)
		if (!entry.bot) return null
		return (
			<BotRosterRow
				{...shared}
				bot={entry.bot}
				isSelected={entry.bot.id === activeBotId}
				key={entry.id}
				memberships={membershipsOf(entry.bot.id)}
				onAddToSpace={onAddBotToSpace}
				onDelete={onDeleteBot}
				onDuplicate={onDuplicateBot}
				onEdit={onEditBot}
				onRemoveFromSpace={onRemoveBotFromSpace}
				onSelect={onSelectBot}
				openSpaceId={spaceId}
				spaces={spaces}
			/>
		)
	}

	const menuOf = (entries: PinnedEntry[], isSlotted: boolean) => (
		<SidebarMenu className={ROSTER_ROWS}>
			{entries.map((entry) => rowFor(entry, isSlotted))}
		</SidebarMenu>
	)

	const menuOfRows = (
		heldConversations: AppSidebarConversation[],
		held: AppSidebarBot[],
	) =>
		menuOf(
			waitingFirst(
				[
					...heldConversations.map((conversation) =>
						conversationEntry(conversation),
					),
					...held.map((bot) => botEntry(bot)),
				].toSorted(byMostRecent),
			),
			false,
		)

	const surface: RosterSurfaceProps = {
		onCreateBot,
		onCreateConversation,
		onCreateSection: onCreateSection ? nameLooseSection : undefined,
		onOpenSpaceSettings,
	}

	if (haveBotsFailedToLoad && bots.length === 0)
		return (
			<RosterSurface {...surface}>
				<p className={EMPTY_COPY}>{t("roster.unavailable")}</p>
			</RosterSurface>
		)

	if (
		!naming &&
		bots.length === 0 &&
		conversations.length === 0 &&
		sections.length === 0
	)
		return (
			<RosterSurface {...surface}>
				<p className={EMPTY_COPY}>{t("roster.empty")}</p>
			</RosterSurface>
		)

	const namedBots = bots.filter((bot) => isNamed(bot.id))
	const namedConversations = conversations.filter((conversation) =>
		isNamed(conversation.id),
	)
	const hasNamedRow = namedBots.length + namedConversations.length > 0
	const hasSortedRows = sortedBots.length + sortedConversations.length > 0
	const isLifting = Boolean(liftedEntry && !liftedEntry.section)
	const hasPinnedZone = topLevel.length > 0 || isLifting

	return (
		<>
			{hasPinnedZone ? (
				<RosterDropArea
					className={PINNED_ZONE_STACK}
					isLanding={topLevel.length === 0 && insertion !== null}
					landing={PINNED_ZONE}
				>
					{topLevel.length > 0 ? (
						inRuns(topLevel).map((run) => {
							const [entry] = run
							if (!entry.section) return menuOf(run, true)
							const rank = topLevel.indexOf(entry)
							const heldRows = rowsOf(entry.section.id)
							const isLifted = entry.section.id === liftedSectionId
							return (
								<RosterDropArea
									insertion={edgeAt(entry.id)}
									isLanding={landingSection === entry.section.id}
									isLifted={isLifted}
									key={entry.id}
									landing={entry.id}
									ref={(node) => {
										cardFor(entry.id)(node)
										if (isLifted) rosterLift.followRef(node)
									}}
								>
									<RosterSection
										headRef={slotFor(entry.id)}
										isFirst={rank === 0}
										isLast={rank === topLevel.length - 1}
										isOpen={!collapsedSectionIds.includes(entry.section.id)}
										lift={rosterLift}
										onOpenChange={(isOpen) =>
											onCollapseSection?.(entry.section?.id ?? "", !isOpen)
										}
										onDelete={onDeleteSection}
										onMove={moveSection}
										onRename={onRenameSection}
										section={entry.section}
									>
										{heldRows.length > 0 ? (
											menuOf(heldRows, true)
										) : (
											<SectionDropZone name={entry.section.name} />
										)}
									</RosterSection>
								</RosterDropArea>
							)
						})
					) : (
						<SectionDropZone
							label={t("roster.pinDrop")}
							name={t("roster.pin")}
						/>
					)}
				</RosterDropArea>
			) : null}
			{hasPinnedZone ? <RosterZoneSeparator /> : null}
			{hasSortedRows || isLifting ? (
				<RosterDropArea
					isLanding={rosterLift.lift?.landing === SORTED}
					landing={SORTED_ZONE}
				>
					{hasSortedRows ? (
						menuOfRows(sortedConversations, sortedBots)
					) : (
						<SectionDropZone name={t("roster.label")} />
					)}
				</RosterDropArea>
			) : null}
			{naming ? (
				<SidebarGroup className={SECTION_GROUP}>
					<SectionLabel>
						<SectionNameField
							ariaLabel={t("roster.section.createField")}
							initialName={t("roster.section.createDefault")}
							onCancel={stopNaming}
							onCommit={(name) => {
								stopNaming()
								onCreateSection?.(name, naming.rowId ?? undefined)
							}}
						/>
					</SectionLabel>
					{hasNamedRow ? (
						<SidebarGroupContent>
							{menuOfRows(namedConversations, namedBots)}
						</SidebarGroupContent>
					) : null}
				</SidebarGroup>
			) : null}
			<RosterSurface {...surface} />
			{isLifting
				? createPortal(
						<LiftedRow
							bot={liftedEntry?.bot}
							conversation={liftedEntry?.conversation}
							ref={rosterLift.followRef}
						/>,
						document.body,
					)
				: null}
		</>
	)
}

const NEIGHBOURING = 1

const CROSSING = 0.55

const SETTLING = 150

const isFlushWithPanel = (row: HTMLDivElement) => {
	const under = row.children[Math.round(row.scrollLeft / row.clientWidth)]
	if (!under) return false
	const drift =
		under.getBoundingClientRect().left - row.getBoundingClientRect().left
	return Math.abs(drift) <= 1
}

interface SpacePanelProps {
	spaceId: string
	isInView: boolean
	scrolls: Map<string, number>
	children: ReactNode
}

const SpacePanel = ({
	spaceId,
	isInView,
	scrolls,
	children,
}: SpacePanelProps) => {
	const panel = useRef<HTMLDivElement>(null)
	useOverlayScrollbars(panel, { options: CLIPPED_SIDEWAYS })

	return (
		<div
			className={CAROUSEL_PANEL}
			data-slot="space-panel"
			inert={!isInView}
			onScroll={(event) => {
				scrolls.set(spaceId, event.currentTarget.scrollTop)
			}}
			ref={(node) => {
				panel.current = node
				if (node) node.scrollTop = scrolls.get(spaceId) ?? 0
			}}
		>
			{children}
		</div>
	)
}

interface SpaceCarouselProps {
	spaces: Space[]
	selectedSpaceId?: string
	isSwipeEnabled: boolean
	onSelectSpace?: (id: string) => void
	renderSpace: (space: Space) => ReactNode
}

const SpaceCarousel = ({
	spaces,
	selectedSpaceId,
	isSwipeEnabled,
	onSelectSpace,
	renderSpace,
}: SpaceCarouselProps) => {
	const viewport = useRef<HTMLDivElement>(null)
	const scrolls = useRef(new Map<string, number>()).current
	const isCut = useReducedMotion() ?? false
	const chosen = Math.max(
		spaces.findIndex((space) => space.id === selectedSpaceId),
		0,
	)
	const [restingOn, setRestingOn] = useState(chosen)
	const covering = useRef(chosen)
	const settling = useRef<ReturnType<typeof setTimeout>>(undefined)

	const restsOn = Math.min(restingOn, spaces.length - 1)
	const firstDrawn = Math.max(restsOn - NEIGHBOURING, 0)
	const nearby = spaces.slice(firstDrawn, restsOn + NEIGHBOURING + 1)
	const chosenSlot = chosen - firstDrawn
	const isBeside = chosenSlot >= 0 && chosenSlot < nearby.length

	useLayoutEffect(() => {
		const node = viewport.current
		if (!node) return
		const restingSlot = restsOn - firstDrawn
		node.scrollLeft = restingSlot * node.clientWidth
	}, [restsOn, firstDrawn])

	useEffect(() => {
		const node = viewport.current
		if (!node || chosen === covering.current) return
		if (!isBeside || isCut) {
			setRestingOn(chosen)
			return
		}
		node.scrollTo({ behavior: "smooth", left: chosenSlot * node.clientWidth })
	}, [chosen, chosenSlot, isBeside, isCut])

	const spaceCrossed = (node: HTMLDivElement) => {
		const drifted =
			firstDrawn + node.scrollLeft / node.clientWidth - covering.current
		if (Math.abs(drifted) < CROSSING) return covering.current
		return covering.current + Math.round(drifted)
	}

	const settle = () => {
		const node = viewport.current
		if (!node || !isFlushWithPanel(node)) return
		setRestingOn(covering.current)
	}

	const follow = (event: UIEvent<HTMLDivElement>) => {
		clearTimeout(settling.current)
		settling.current = setTimeout(settle, SETTLING)
		const crossed = spaceCrossed(event.currentTarget)
		if (crossed === covering.current) return
		covering.current = crossed
		const space = spaces[crossed]
		if (space && space.id !== selectedSpaceId) onSelectSpace?.(space.id)
	}

	return (
		<div
			className={cn(
				CAROUSEL,
				isSwipeEnabled ? CAROUSEL_SWIPEABLE : CAROUSEL_HELD,
			)}
			data-slot="space-carousel"
			onScroll={follow}
			ref={viewport}
		>
			{nearby.map((space) => (
				<SpacePanel
					isInView={space.id === selectedSpaceId}
					key={space.id}
					scrolls={scrolls}
					spaceId={space.id}
				>
					{renderSpace(space)}
				</SpacePanel>
			))}
		</div>
	)
}

const CreateMenu = (items: CreateItemsProps) => {
	const { t } = useTranslation("bots")
	const label = t("roster.createMenu")

	return (
		<ContextMenu>
			<ContextMenuPressTrigger
				render={
					<TooltipButton
						aria-label={label}
						size="icon-sm"
						tooltip={label}
						tooltipSide="bottom"
						variant="ghost"
					>
						<Icons.Add aria-hidden="true" />
					</TooltipButton>
				}
			/>
			<ContextMenuContent
				aria-label={label}
				className={STILL_UNDER_REDUCED_MOTION}
			>
				<CreateItems {...items} />
			</ContextMenuContent>
		</ContextMenu>
	)
}

type AppSidebarPanelProps = Omit<
	ComponentProps<typeof Sidebar>,
	"children" | "collapsible"
>

interface AppSidebarProps
	extends AppSidebarPanelProps,
		BotRosterActions,
		ConversationRosterActions,
		SectionActions {
	bots: AppSidebarBot[]
	haveBotsFailedToLoad?: boolean
	botsBySpaceId?: Record<string, AppSidebarBot[]>
	conversations?: AppSidebarConversation[]
	conversationsBySpaceId?: Record<string, AppSidebarConversation[]>
	badgesBySpaceId?: Record<string, BotBadge>
	sections?: AppSidebarSection[]
	sectionsBySpaceId?: Record<string, AppSidebarSection[]>
	collapsedSectionIds?: string[]
	selectedBotId?: string
	selectedConversationId?: string
	onCreateBot?: () => void
	onCreateConversation?: () => void
	spaces?: Space[]
	selectedSpaceId?: string
	isSpaceSwitchingEnabled?: boolean
	onSelectSpace?: (id: string) => void
	onReorderSpaces?: (ids: string[]) => void
	onCreateSpace?: () => void
	onOpenSpaceSettings?: () => void
	footer?: ReactNode
	user?: UserChipIdentity
	onOpenUserSettings?: () => void
	onOpenSearch?: () => void
	insetWindowControls?: boolean
}

const AppSidebarBase = ({
	bots: roster,
	haveBotsFailedToLoad,
	botsBySpaceId,
	conversations: rooms = NO_CONVERSATIONS,
	conversationsBySpaceId,
	badgesBySpaceId,
	sections = NO_SECTIONS,
	sectionsBySpaceId,
	collapsedSectionIds = NO_COLLAPSED_SECTIONS,
	selectedBotId: selectedId,
	selectedConversationId,
	onSelectConversation,
	onCreateConversation,
	onOpenConversationSettings,
	onDeleteConversation,
	onSelectBot,
	onCreateBot,
	onEditBot,
	onDuplicateBot,
	onAddBotToSpace,
	onRemoveBotFromSpace,
	onDeleteBot,
	onCreateSection,
	onRenameSection,
	onDeleteSection,
	onCollapseSection,
	onPinRoster,
	spaces = [],
	selectedSpaceId,
	isSpaceSwitchingEnabled = true,
	onSelectSpace,
	onReorderSpaces,
	onCreateSpace,
	onOpenSpaceSettings,
	footer,
	user,
	onOpenUserSettings,
	onOpenSearch,
	insetWindowControls = false,
	...panel
}: AppSidebarProps) => {
	probeRender("AppSidebar")
	const { t } = useTranslation("bots")
	const createLabel = t("roster.create")
	const [naming, setNaming] = useState<SectionNaming | null>(null)
	const nameLooseSection = () => setNaming({ rowId: null })
	const actions: BotRosterActions &
		ConversationRosterActions &
		SectionActions &
		RosterCreateActions &
		RosterSpaceActions = {
		onAddBotToSpace,
		onCollapseSection,
		onCreateBot,
		onCreateConversation,
		onCreateSection,
		onDeleteBot,
		onDeleteConversation,
		onDeleteSection,
		onDuplicateBot,
		onEditBot,
		onOpenConversationSettings,
		onOpenSpaceSettings,
		onPinRoster,
		onRemoveBotFromSpace,
		onRenameSection,
		onSelectBot,
		onSelectConversation,
	}

	const rosterOf = (spaceId: string) => botsBySpaceId?.[spaceId] ?? NO_BOTS

	const roomsOf = (spaceId: string) =>
		conversationsBySpaceId
			? (conversationsBySpaceId[spaceId] ?? NO_CONVERSATIONS)
			: rooms

	const sectionsOf = (spaceId: string) =>
		sectionsBySpaceId ? (sectionsBySpaceId[spaceId] ?? NO_SECTIONS) : sections

	const membershipsOf = (botId: string) =>
		spaceIdsOfBot({ botId, botsBySpaceId })

	const hasRosterPerSpace = Boolean(botsBySpaceId) && spaces.length > 0
	const shown =
		hasRosterPerSpace && selectedSpaceId ? rosterOf(selectedSpaceId) : roster
	const shownRooms =
		hasRosterPerSpace && selectedSpaceId ? roomsOf(selectedSpaceId) : rooms
	const selectedBot = shown.find((bot) => bot.id === selectedId)
	const selectedConversation = shownRooms.find(
		(room) => room.id === selectedConversationId,
	)

	const selectRank = (rank: number) => {
		const space = spaceAtRank(spaces, rank)
		if (space) onSelectSpace?.(space.id)
	}

	useSpaceShortcut({
		count: spaces.length,
		isEnabled: isSpaceSwitchingEnabled,
		onRank: selectRank,
	})

	return (
		<>
			<Sidebar
				{...panel}
				aria-busy={shown.some(isBusy) || shownRooms.some(isBusy)}
				aria-label={t("roster.label")}
				className={PANEL}
				collapsible="icon"
				role="complementary"
			>
				<SidebarHeader
					className={cn(
						HEADER,
						insetWindowControls
							? WINDOW_CONTROLS_INSET
							: NO_WINDOW_CONTROLS_INSET,
					)}
				>
					<SpaceSwitcher
						badgesBySpaceId={badgesBySpaceId}
						onCreateSpace={onCreateSpace}
						onOpenSpaceSettings={onOpenSpaceSettings}
						onReorderSpaces={onReorderSpaces}
						onSelectSpace={onSelectSpace}
						selectedSpaceId={selectedSpaceId}
						spaces={spaces}
					/>
					{onCreateConversation ? (
						<CreateMenu
							onCreateBot={onCreateBot}
							onCreateConversation={onCreateConversation}
							onCreateSection={onCreateSection ? nameLooseSection : undefined}
						/>
					) : (
						<TooltipButton
							aria-label={createLabel}
							onClick={onCreateBot}
							size="icon-sm"
							tooltip={createLabel}
							tooltipSide="bottom"
							variant="ghost"
						>
							<Icons.Add aria-hidden="true" />
						</TooltipButton>
					)}
				</SidebarHeader>
				{onOpenSearch ? (
					<SidebarSearchSlot onOpenSearch={onOpenSearch} />
				) : null}
				<SidebarContent
					className={hasRosterPerSpace ? CAROUSEL_CONTENT : CONTENT_INSET}
				>
					{hasRosterPerSpace ? (
						<SpaceCarousel
							isSwipeEnabled={isSpaceSwitchingEnabled && spaces.length > 1}
							onSelectSpace={onSelectSpace}
							renderSpace={(space) => (
								<BotRoster
									{...actions}
									bots={rosterOf(space.id)}
									collapsedSectionIds={collapsedSectionIds}
									haveBotsFailedToLoad={haveBotsFailedToLoad}
									conversations={roomsOf(space.id)}
									membershipsOf={membershipsOf}
									naming={space.id === selectedSpaceId ? naming : null}
									onNaming={setNaming}
									sections={sectionsOf(space.id)}
									selectedBotId={selectedId}
									selectedConversationId={selectedConversationId}
									spaceId={space.id}
									spaces={spaces}
								/>
							)}
							selectedSpaceId={selectedSpaceId}
							spaces={spaces}
						/>
					) : (
						<BotRoster
							{...actions}
							bots={roster}
							collapsedSectionIds={collapsedSectionIds}
							haveBotsFailedToLoad={haveBotsFailedToLoad}
							conversations={rooms}
							membershipsOf={membershipsOf}
							naming={naming}
							onNaming={setNaming}
							sections={sections}
							selectedBotId={selectedId}
							selectedConversationId={selectedConversationId}
							spaceId={selectedSpaceId}
							spaces={spaces}
						/>
					)}
				</SidebarContent>
				{user || footer || spaces.length > 1 ? (
					<SidebarFooter className={FOOTER_INSET}>
						<SpaceDots
							badgesBySpaceId={badgesBySpaceId}
							onReorderSpaces={onReorderSpaces}
							onSelectSpace={onSelectSpace}
							selectedSpaceId={selectedSpaceId}
							spaces={spaces}
						/>
						{user || footer ? (
							<span className={FOOTER_ROW}>
								{user ? (
									<UserChip
										image={user.image}
										name={user.name}
										onOpen={onOpenUserSettings}
									/>
								) : null}
								<span className={FOOTER_SLOT}>{footer}</span>
							</span>
						) : null}
					</SidebarFooter>
				) : null}
				<SidebarResizeHandle side="left" />
			</Sidebar>
			<span className="sr-only" role="status">
				{announcementFor(t, selectedBot, selectedConversation)}
			</span>
		</>
	)
}

const AppSidebar = memo(AppSidebarBase)

export {
	AppSidebar,
	type AppSidebarBot,
	type AppSidebarConversation,
	type AppSidebarProps,
	type AppSidebarRowMission,
	type AppSidebarSection,
	type BotAvatarBlot,
	ROW_AVATAR_SIZE,
	type RosterPin,
	type Space,
	type UserChipIdentity,
}
