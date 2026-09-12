"use client"

import type { ReactNode } from "react"

import { type BotBadge, BotBadgeDot } from "@workspace/ui/components/bot-badge"
import {
	TextShimmer,
	WORKING_SHIMMER_DURATION,
} from "@workspace/ui/components/motion/text-shimmer"
import {
	SidebarMenuRow,
	type SidebarMenuRowProps,
} from "@workspace/ui/components/sidebar-menu-row"
import { Item } from "@workspace/ui/components/ui/item"
import { useSidebar } from "@workspace/ui/components/ui/sidebar"

const ROW =
	"flex-nowrap border-0 py-1.5 pl-1.5 transition-[width,height,padding,translate] focus-visible:ring-sidebar-ring active:translate-y-px aria-expanded:bg-sidebar-accent/70 group-data-[collapsible=icon]:pl-0"

const STACK = "relative flex h-9 min-w-0 flex-col justify-center"

const NAME_LINE = "flex h-5 min-w-0 items-center gap-1.5"

const TIMESTAMP =
	"ml-auto h-5 w-11 shrink-0 truncate text-right text-[11px] text-muted-foreground leading-5 tabular-nums"

const PREVIEW =
	"h-4 truncate pe-3.5 text-muted-foreground text-xs leading-4 empty:h-0"

const STRIPS = "flex flex-col gap-1"

type SidebarListRowElementProps = Omit<
	SidebarMenuRowProps,
	| "label"
	| "children"
	| "below"
	| "icon"
	| "isIconDecorative"
	| "className"
	| "render"
>

interface SidebarListRowProps extends SidebarListRowElementProps {
	name: string
	media?: ReactNode
	trailing?: ReactNode
	timestamp?: string
	preview?: string
	isWorking?: boolean
	badge?: BotBadge
	strips?: ReactNode
}

const SidebarListRow = ({
	name,
	media,
	trailing,
	timestamp,
	preview,
	isWorking = false,
	badge,
	strips,
	...rowProps
}: SidebarListRowProps) => {
	const { state } = useSidebar()
	const hasStrips = Boolean(strips) && state !== "collapsed"

	return (
		<SidebarMenuRow
			{...rowProps}
			below={
				hasStrips ? (
					<span className={STRIPS} data-slot="roster-row-missions">
						{strips}
					</span>
				) : undefined
			}
			className={ROW}
			icon={media}
			isIconDecorative={false}
			label={name}
			render={<Item render={<button type="button" />} />}
		>
			<span className={STACK}>
				<span className={NAME_LINE}>
					<span className="truncate" data-slot="roster-row-name">
						{name}
					</span>
					{trailing}
					{timestamp === undefined ? null : (
						<span className={TIMESTAMP} data-slot="roster-row-timestamp">
							{timestamp}
						</span>
					)}
				</span>
				{preview === undefined ? null : (
					<span className={PREVIEW} data-slot="roster-row-preview">
						{isWorking ? (
							<TextShimmer
								className="inline"
								duration={WORKING_SHIMMER_DURATION}
							>
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
		</SidebarMenuRow>
	)
}

export { SidebarListRow, type SidebarListRowProps }
