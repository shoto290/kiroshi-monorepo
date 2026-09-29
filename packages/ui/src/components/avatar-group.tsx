"use client"

import { motion, useReducedMotionConfig } from "motion/react"
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
import { SPRING_LAYOUT, TRANSITION_NONE } from "@workspace/ui/lib/ease"

const DEFAULT_SIZE = 40

const ARTBOARD_SIZE = 96

const CELL_LIMIT = 3

const FRAME = "relative grid shrink-0"

const MEMBER_CELL = "absolute"

const OVERFLOW_CELL = "pointer-events-none absolute"

const OVERFLOW_ART = "block size-full"

const COUNTER_TEXT = "font-bold tabular-nums"

const COLUMN_GAP_RATIO = 0.94

const ROW_PITCH_RATIO = 1.087

const CELL_HEIGHT_RATIO = 0.4775

const COUNTER_FONT_RATIO = { small: 0.4605, large: 0.3589 }

const CAP_CENTRE_RATIO = 0.36

const FILL_ORDER = [
	{ column: 0, row: 0 },
	{ column: 1, row: 0.5 },
	{ column: 0, row: 1 },
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

const workingFirst = (participants: ConversationParticipant[]) => [
	...participants.filter(({ working }) => working),
	...participants.filter(({ working }) => !working),
]

type MemberCellProps = {
	participant: ConversationParticipant
	shape: CellShape
	spot: Spot
	isStill: boolean
}

const MemberCell = ({ participant, shape, spot, isStill }: MemberCellProps) => {
	const reach = participant.isPerson ? shape.halfHeight : shape.halfWidth
	return (
		<motion.span
			className={MEMBER_CELL}
			data-slot="conversation-avatar-member"
			layout="position"
			style={{ left: spot.x - reach, top: spot.y - reach }}
			transition={isStill ? TRANSITION_NONE : SPRING_LAYOUT}
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
		</motion.span>
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
	const side = shape.halfWidth * 2
	return (
		<span
			className={OVERFLOW_CELL}
			data-slot="conversation-avatar-overflow"
			style={{
				left: spot.x - shape.halfWidth,
				top: spot.y - shape.halfWidth,
				width: side,
				height: side,
			}}
		>
			<svg
				aria-hidden="true"
				className={OVERFLOW_ART}
				viewBox={`0 0 ${side} ${side}`}
			>
				<path
					d={shape.path}
					style={{ fill: "var(--sidebar-accent-foreground)" }}
				/>
				<text
					className={COUNTER_TEXT}
					fontSize={font}
					style={{ fill: "var(--sidebar)" }}
					textAnchor="middle"
					x={shape.halfWidth}
					y={shape.halfWidth + font * CAP_CENTRE_RATIO}
				>
					{label}
				</text>
			</svg>
		</span>
	)
}

const AvatarGroup = ({
	participants,
	size = DEFAULT_SIZE,
	badge,
}: AvatarGroupProps) => {
	const { t } = useTranslation("bots")
	const isStill = useReducedMotionConfig() ?? false
	const cellCount = Math.min(participants.length, CELL_LIMIT)
	const cellHeight = CELL_HEIGHT_RATIO * size
	const shape = cellShapeOf(cellHeight)
	const spots = clusterSpots(cellCount, cellHeight, size)
	const isOverflowing = participants.length > CELL_LIMIT
	const shown = workingFirst(participants).slice(
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
					isStill={isStill}
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
