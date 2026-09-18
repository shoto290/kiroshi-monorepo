"use client"

import type { ReactNode } from "react"

import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import {
	TextShimmer,
	WORKING_SHIMMER_DURATION,
} from "@workspace/ui/components/motion/text-shimmer"
import { cn } from "@workspace/ui/lib/utils"

type RowGeometry = "roster" | "activity"

type RowPart = {
	key: string
	text: string
}

const DOT_CLASS = "before:mx-1 before:content-['·']"

const ACTIVITY_ROW_CLASS =
	"flex min-h-13 w-full items-center gap-2.5 rounded-xl py-1.5 pe-3 ps-1.5 text-start"

const ROW_GLYPH_CLASS = "size-[11px] shrink-0"

const IDENTIFIER_CLASS = "shrink-0 font-medium tabular-nums"

const PARTS_CLASS = "min-w-0 truncate"

const STACK: Record<RowGeometry, string> = {
	roster: "relative flex h-9 min-w-0 flex-col justify-center",
	activity: "flex min-w-0 flex-1 flex-col gap-px",
}

const NAME_LINE = "flex h-5 min-w-0 items-center gap-1.5"

const NAME: Record<RowGeometry, string> = {
	roster: "truncate",
	activity: "min-w-0 flex-1 truncate font-medium text-foreground text-sm",
}

const TIMESTAMP: Record<RowGeometry, string> = {
	roster:
		"ml-auto h-5 w-11 shrink-0 truncate text-right text-[11px] text-muted-foreground leading-5 tabular-nums",
	activity: "shrink-0 text-[11px] text-muted-foreground leading-5 tabular-nums",
}

const PREVIEW: Record<RowGeometry, string> = {
	roster:
		"h-4 truncate pe-3.5 text-muted-foreground text-xs leading-4 empty:h-0",
	activity: "flex h-4 items-center gap-[5px] text-muted-foreground text-xs",
}

type RowPartsProps = {
	parts: RowPart[]
	slot: string
	identifier?: string
	lead?: ReactNode
}

const RowParts = ({ parts, slot, identifier, lead }: RowPartsProps) => {
	const written = parts.filter((part) => part.text !== "")
	const isLed = identifier !== undefined || lead !== undefined

	return (
		<>
			{identifier === undefined ? null : (
				<span className={IDENTIFIER_CLASS}>{identifier}</span>
			)}
			<span className={PARTS_CLASS} data-slot={slot}>
				{lead}
				{written.map((part, index) => (
					<span
						className={index === 0 && !isLed ? undefined : DOT_CLASS}
						key={part.key}
					>
						{part.text}
					</span>
				))}
			</span>
		</>
	)
}

type RowAnatomyProps = {
	geometry: RowGeometry
	name: ReactNode
	media?: ReactNode
	trailing?: ReactNode
	timestamp?: string
	preview?: ReactNode
	isWorking?: boolean
	isNameMuted?: boolean
	isNameRegular?: boolean
	badge?: BotBadge
	nameSlot?: string
	timestampSlot?: string
	previewSlot?: string
}

const RowAnatomy = ({
	geometry,
	name,
	media,
	trailing,
	timestamp,
	preview,
	isWorking = false,
	isNameMuted = false,
	isNameRegular = false,
	badge,
	nameSlot,
	timestampSlot,
	previewSlot,
}: RowAnatomyProps) => (
	<>
		{media}
		<span className={STACK[geometry]}>
			<span className={NAME_LINE}>
				<span
					className={cn(
						NAME[geometry],
						isNameMuted && "text-muted-foreground",
						isNameRegular && "font-normal",
					)}
					data-slot={nameSlot}
				>
					{name}
				</span>
				{trailing}
				{timestamp === undefined ? null : (
					<span className={TIMESTAMP[geometry]} data-slot={timestampSlot}>
						{timestamp}
					</span>
				)}
			</span>
			{preview === undefined ? null : (
				<span className={PREVIEW[geometry]} data-slot={previewSlot}>
					{isWorking ? (
						<TextShimmer className="inline" duration={WORKING_SHIMMER_DURATION}>
							{preview}
						</TextShimmer>
					) : (
						preview
					)}
				</span>
			)}
			{badge ? (
				<BotBadgeDot
					badge={badge}
					data-slot="bot-activity-dot"
					placement="row"
				/>
			) : null}
		</span>
	</>
)

export {
	ACTIVITY_ROW_CLASS,
	DOT_CLASS,
	ROW_GLYPH_CLASS,
	RowAnatomy,
	type RowAnatomyProps,
	type RowGeometry,
	type RowPart,
	RowParts,
	type RowPartsProps,
}
