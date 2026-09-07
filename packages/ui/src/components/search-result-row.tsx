"use client"

import { useTranslation } from "react-i18next"

import {
	ACTIVATION_CLASS,
	type ActivityRowPart,
	ROW_CLASS,
} from "@workspace/ui/components/activity-row"
import { Avatar } from "@workspace/ui/components/avatar"
import {
	AvatarGroup,
	type ConversationParticipant,
} from "@workspace/ui/components/avatar-group"
import type { BotBadge } from "@workspace/ui/components/badge"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { Icons } from "@workspace/ui/components/icons"
import { Kbd } from "@workspace/ui/components/kbd"
import {
	MISSION_AVATAR_SIZE,
	type MissionBot,
} from "@workspace/ui/components/mission"
import type { MissionMark } from "@workspace/ui/components/mission-marks"
import { cn } from "@workspace/ui/lib/utils"

type SearchResultIdentity =
	| { kind: "message"; bot: MissionBot }
	| { kind: "message-from-you"; reader: string }
	| { kind: "chat-group"; participants: ConversationParticipant[] }
	| { kind: "chat-solo"; bot: MissionBot }
	| { kind: "mission"; bot: MissionBot; badge: BotBadge; mark: MissionMark }
	| { kind: "routine"; bot: MissionBot }

type SearchResultKind = SearchResultIdentity["kind"]

type SearchResultTitlePart = ActivityRowPart & { isMatch?: boolean }

type SearchResultRowProps = {
	identity: SearchResultIdentity
	title: SearchResultTitlePart[]
	timestamp: string
	parts: ActivityRowPart[]
	identifier?: string
	rank?: number
	isActive?: boolean
	onOpen: () => void
}

const FIRST_RANK = 1

const LAST_RANK = 9

const DOT_CLASS = "before:mx-1 before:content-['·']"

const ACTIVE_CLASS = "group/search-result-row data-[active=true]:bg-muted"

const MATCH_CLASS =
	"rounded-[0.2em] bg-mark/40 px-[0.15em] py-[0.05em] text-inherit"

const RANK_LANE_CLASS = "flex w-[26px] shrink-0 justify-center self-start"

const RANK_CLASS =
	"group-data-[active=true]/search-result-row:bg-background leading-4"

const BADGE_RING_CLASS = "[--badge-ring:var(--color-popover)]"

const isMessageKind = (identity: SearchResultIdentity) =>
	identity.kind === "message" || identity.kind === "message-from-you"

const glyphOf = (identity: SearchResultIdentity): MissionMark | undefined => {
	if (identity.kind === "mission") return identity.mark
	if (identity.kind === "routine") return Icons.Routine
	return undefined
}

const SearchResultIdentityMark = ({
	identity,
}: {
	identity: SearchResultIdentity
}) => {
	if (identity.kind === "chat-group")
		return (
			<AvatarGroup
				participants={identity.participants}
				size={MISSION_AVATAR_SIZE}
			/>
		)

	if (identity.kind === "message-from-you")
		return (
			<Avatar
				className="shrink-0"
				name={identity.reader}
				size={MISSION_AVATAR_SIZE}
			/>
		)

	return (
		<BotIdentityAvatar
			{...identity.bot}
			badge={identity.kind === "mission" ? identity.badge : undefined}
			className={cn("shrink-0", BADGE_RING_CLASS)}
			size={MISSION_AVATAR_SIZE}
		/>
	)
}

const SearchResultRow = ({
	identity,
	title,
	timestamp,
	parts,
	identifier,
	rank,
	isActive = false,
	onOpen,
}: SearchResultRowProps) => {
	const { t } = useTranslation("search")
	const Glyph = glyphOf(identity)
	const written = parts.filter((part) => part.text !== "")
	const spoken =
		identity.kind === "chat-solo"
			? [...written, { key: "solo-thread", text: t("result.soloThread") }]
			: written
	const isRanked = rank !== undefined && rank >= FIRST_RANK && rank <= LAST_RANK

	return (
		<li data-slot="search-result-row">
			<button
				className={cn(ROW_CLASS, ACTIVATION_CLASS, ACTIVE_CLASS)}
				data-active={isActive}
				onClick={onOpen}
				type="button"
			>
				<SearchResultIdentityMark identity={identity} />
				<span className="flex min-w-0 flex-1 flex-col gap-px">
					<span className="flex h-5 items-center gap-1.5">
						<span
							className={cn(
								"min-w-0 flex-1 truncate text-foreground text-sm leading-5",
								isMessageKind(identity) ? "font-normal" : "font-medium",
							)}
							data-slot="search-result-row-title"
						>
							{title.map((part) =>
								part.isMatch ? (
									<mark className={MATCH_CLASS} key={part.key}>
										{part.text}
									</mark>
								) : (
									<span key={part.key}>{part.text}</span>
								),
							)}
						</span>
						<span
							className="shrink-0 text-[11px] text-muted-foreground leading-5 tabular-nums"
							data-slot="search-result-row-timestamp"
						>
							{timestamp}
						</span>
					</span>
					<span className="flex h-4 items-center gap-[5px] text-muted-foreground text-xs leading-4">
						{Glyph ? (
							<Glyph
								aria-hidden="true"
								className="size-[11px] shrink-0"
								data-slot="search-result-row-glyph"
							/>
						) : null}
						{identifier ? (
							<span className="shrink-0 font-medium tabular-nums">
								{identifier}
							</span>
						) : null}
						<span
							className="min-w-0 truncate"
							data-slot="search-result-row-parts"
						>
							{spoken.map((part, index) => (
								<span
									className={index === 0 && !identifier ? undefined : DOT_CLASS}
									key={part.key}
								>
									{part.text}
								</span>
							))}
						</span>
					</span>
				</span>
				<span className={RANK_LANE_CLASS} data-slot="search-result-row-rank">
					{isRanked ? (
						<>
							<span className="sr-only">{t("result.rank", { rank })}</span>
							<Kbd aria-hidden="true" className={RANK_CLASS}>
								{rank}
							</Kbd>
						</>
					) : null}
				</span>
			</button>
		</li>
	)
}

export {
	type SearchResultIdentity,
	type SearchResultKind,
	SearchResultRow,
	type SearchResultRowProps,
	type SearchResultTitlePart,
}
