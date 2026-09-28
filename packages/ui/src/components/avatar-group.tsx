"use client"

import { useTranslation } from "react-i18next"

import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import {
	BotIdentityAvatar,
	type BotIdentityAvatarProps,
} from "@workspace/ui/components/bot-identity-avatar"
import { InitialsAvatar } from "@workspace/ui/components/initials-avatar"
import {
	OUTER,
	roundedHexagonPath,
} from "@workspace/ui/components/kiroshi-hexagon"

const DEFAULT_SIZE = 40

const ARTBOARD_SIZE = 96

const CELL_LIMIT = 4

const FRAME = "relative grid shrink-0"

const MEMBER_CELL = "absolute"

const OVERFLOW_LAYER = "pointer-events-none absolute inset-0"

const COUNTER_TEXT = "font-bold tabular-nums"

const COLUMN_GAP_RATIO = 0.94

const ROW_PITCH_RATIO = 1.087

const LOOSE_CELL_RATIO = 0.4775

const PACKED_CELL_RATIO = 0.38

const COUNTER_FONT_RATIO = { small: 0.4605, large: 0.3589 }

const CAP_CENTRE_RATIO = 0.36

const FILL_ORDER = [
	{ column: 0, row: 0 },
	{ column: 1, row: 0.5 },
	{ column: 0, row: 1 },
	{ column: 1, row: 1.5 },
]

type ConversationParticipant = Pick<
	BotIdentityAvatarProps,
	"name" | "blot" | "image" | "working" | "kind"
> & { id: string; isPerson?: boolean }

type AvatarGroupProps = {
	participants: ConversationParticipant[]
	size?: number
	badge?: BotBadge
}

type CellShape = { halfWidth: number; halfHeight: number; path: string }

type Spot = { x: number; y: number }

const cellShapeOf = (cellHeight: number): CellShape => {
	const scale = cellHeight / (OUTER.halfHeight * 2)
	const hexagon = {
		halfWidth: OUTER.halfWidth * scale,
		halfHeight: OUTER.halfHeight * scale,
	}
	return { ...hexagon, path: roundedHexagonPath(hexagon) }
}

const middleOf = (values: number[]) =>
	(Math.min(...values) + Math.max(...values)) / 2

const clusterSpots = (count: number, cellHeight: number, size: number) => {
	const spots = FILL_ORDER.slice(0, count).map(({ column, row }) => ({
		x: column * COLUMN_GAP_RATIO * cellHeight,
		y: row * ROW_PITCH_RATIO * cellHeight,
	}))
	const shiftX = size / 2 - middleOf(spots.map(({ x }) => x))
	const shiftY = size / 2 - middleOf(spots.map(({ y }) => y))
	return spots.map(({ x, y }): Spot => ({ x: x + shiftX, y: y + shiftY }))
}

const counterFontRatio = (size: number) => {
	const progress = Math.min(
		Math.max((size - DEFAULT_SIZE) / (ARTBOARD_SIZE - DEFAULT_SIZE), 0),
		1,
	)
	return (
		COUNTER_FONT_RATIO.small +
		(COUNTER_FONT_RATIO.large - COUNTER_FONT_RATIO.small) * progress
	)
}

type MemberCellProps = {
	participant: ConversationParticipant
	shape: CellShape
	spot: Spot
}

const MemberCell = ({ participant, shape, spot }: MemberCellProps) => {
	const reach = participant.isPerson ? shape.halfHeight : shape.halfWidth
	return (
		<span
			className={MEMBER_CELL}
			data-slot="conversation-avatar-member"
			style={{ left: spot.x - reach, top: spot.y - reach }}
		>
			{participant.isPerson ? (
				<InitialsAvatar
					image={participant.image}
					name={participant.name}
					size={reach * 2}
				/>
			) : (
				<BotIdentityAvatar
					blot={participant.blot}
					image={participant.image}
					kind={participant.kind}
					name={participant.name}
					seed={participant.id}
					size={reach * 2}
					working={participant.working}
				/>
			)}
		</span>
	)
}

type OverflowCellProps = {
	label: string
	shape: CellShape
	spot: Spot
	size: number
}

const OverflowCell = ({ label, shape, spot, size }: OverflowCellProps) => {
	const font = shape.halfHeight * 2 * counterFontRatio(size)
	return (
		<svg
			aria-hidden="true"
			className={OVERFLOW_LAYER}
			data-slot="conversation-avatar-overflow"
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			width={size}
		>
			<path
				d={shape.path}
				style={{ fill: "var(--sidebar-accent-foreground)" }}
				transform={`translate(${spot.x - shape.halfWidth} ${spot.y - shape.halfWidth})`}
			/>
			<text
				className={COUNTER_TEXT}
				fontSize={font}
				style={{ fill: "var(--sidebar)" }}
				textAnchor="middle"
				x={spot.x}
				y={spot.y + font * CAP_CENTRE_RATIO}
			>
				{label}
			</text>
		</svg>
	)
}

const AvatarGroup = ({
	participants,
	size = DEFAULT_SIZE,
	badge,
}: AvatarGroupProps) => {
	const { t } = useTranslation("bots")
	const cellCount = Math.min(participants.length, CELL_LIMIT)
	const cellHeight =
		(cellCount === CELL_LIMIT ? PACKED_CELL_RATIO : LOOSE_CELL_RATIO) * size
	const shape = cellShapeOf(cellHeight)
	const spots = clusterSpots(cellCount, cellHeight, size)
	const isOverflowing = participants.length > CELL_LIMIT
	const shown = participants.slice(
		0,
		isOverflowing ? CELL_LIMIT - 1 : CELL_LIMIT,
	)
	const overflow = isOverflowing
		? t("roster.conversation.others", {
				count: participants.length - shown.length,
			})
		: null

	return (
		<span
			aria-hidden={overflow ? undefined : "true"}
			aria-label={overflow ?? undefined}
			className={FRAME}
			data-slot="conversation-avatar"
			role="img"
			style={{ width: size, height: size }}
		>
			{shown.map((participant, index) => (
				<MemberCell
					key={participant.id}
					participant={participant}
					shape={shape}
					spot={spots[index]}
				/>
			))}
			{overflow ? (
				<OverflowCell
					label={overflow}
					shape={shape}
					size={size}
					spot={spots[CELL_LIMIT - 1]}
				/>
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

export { AvatarGroup, type AvatarGroupProps, type ConversationParticipant }
