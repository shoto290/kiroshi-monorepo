"use client"

import { useTranslation } from "react-i18next"

import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import {
	BotIdentityAvatar,
	type BotIdentityAvatarProps,
} from "@workspace/ui/components/bot-identity-avatar"
import { COMPANION_SILHOUETTE } from "@workspace/ui/components/companion-picture"

const DEFAULT_SIZE = 40

const AVATAR_GROUP_LIMIT = 3

const HELD_GAP = 2

const FRAME_INSET_RATIO = 0.125

const FRAME = "relative isolate grid shrink-0 place-content-center"

const FRAME_EDGE = "pointer-events-none absolute inset-0 -z-10 bg-border"

const FRAME_FILL = "pointer-events-none absolute inset-px -z-10 bg-muted"

const OVERFLOW_CELL =
	"grid place-content-center bg-foreground/10 font-medium text-foreground leading-none tabular-nums"

const OVERFLOW_FONT_RATIO = 0.5

type ConversationParticipant = Pick<
	BotIdentityAvatarProps,
	"name" | "blot" | "image" | "working" | "kind"
> & { id: string }

type AvatarGroupProps = {
	participants: ConversationParticipant[]
	size?: number
	badge?: BotBadge
}

function AvatarGroup({
	participants,
	size = DEFAULT_SIZE,
	badge,
}: AvatarGroupProps) {
	const { t } = useTranslation("bots")
	const held = participants.slice(0, AVATAR_GROUP_LIMIT)
	const inner = size - Math.round(size * FRAME_INSET_RATIO) * 2
	const isStacked = held.length > 1
	const tile = isStacked ? (inner - HELD_GAP) / 2 : inner
	const leftOut = participants.length - held.length
	const overflow =
		leftOut > 0 ? t("roster.conversation.others", { count: leftOut }) : null

	return (
		<span
			aria-hidden={overflow ? undefined : "true"}
			aria-label={overflow ?? undefined}
			className={FRAME}
			data-slot="conversation-avatar"
			role="img"
			style={{
				width: size,
				height: size,
				gap: HELD_GAP,
				gridTemplateColumns: `repeat(${isStacked ? 2 : 1}, auto)`,
			}}
		>
			<span
				aria-hidden="true"
				className={FRAME_EDGE}
				data-slot="conversation-avatar-edge"
				style={COMPANION_SILHOUETTE}
			/>
			<span
				aria-hidden="true"
				className={FRAME_FILL}
				style={COMPANION_SILHOUETTE}
			/>
			{held.map((participant) => (
				<BotIdentityAvatar
					blot={participant.blot}
					image={participant.image}
					key={participant.id}
					kind={participant.kind}
					name={participant.name}
					seed={participant.id}
					size={tile}
					working={participant.working}
				/>
			))}
			{overflow ? (
				<span
					className={OVERFLOW_CELL}
					data-slot="conversation-avatar-overflow"
					style={{
						...COMPANION_SILHOUETTE,
						width: tile,
						height: tile,
						fontSize: Math.round(tile * OVERFLOW_FONT_RATIO),
					}}
				>
					{overflow}
				</span>
			) : null}
			{badge ? (
				<BotBadgeDot
					badge={badge}
					data-slot="bot-activity-dot"
					placement="avatar"
				/>
			) : null}
		</span>
	)
}

export {
	AVATAR_GROUP_LIMIT,
	AvatarGroup,
	type AvatarGroupProps,
	type ConversationParticipant,
}
