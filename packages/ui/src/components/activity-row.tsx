"use client"

import type { ComponentType } from "react"

import type { BotBadge } from "@workspace/ui/components/badge"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import type { IconProps } from "@workspace/ui/components/icons"
import {
	MISSION_AVATAR_SIZE,
	type MissionBot,
} from "@workspace/ui/components/mission"
import { cn } from "@workspace/ui/lib/utils"

type ActivityRowPart = {
	key: string
	text: string
}

type ActivityRowActivation = {
	id: string
	onOpen: () => void
}

type ActivityRowProps = {
	slot: string
	bot: MissionBot
	badge?: BotBadge
	title: string
	isTitleMuted?: boolean
	timestamp: string
	mark: ComponentType<IconProps>
	identifier?: string
	parts: ActivityRowPart[]
	spokenState?: string
	activation?: ActivityRowActivation
}

const DOT_CLASS = "before:mx-1 before:content-['·']"

const ROW_CLASS =
	"flex min-h-13 w-full items-center gap-2.5 rounded-xl py-1.5 pe-3 ps-1.5 text-start"

const ACTIVATION_CLASS =
	"outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"

const ActivityRow = ({
	slot,
	bot,
	badge,
	title,
	isTitleMuted = false,
	timestamp,
	mark: Mark,
	identifier,
	parts,
	spokenState,
	activation,
}: ActivityRowProps) => {
	const written = parts.filter((part) => part.text !== "")
	const content = (
		<>
			<BotIdentityAvatar
				{...bot}
				badge={badge}
				className="shrink-0"
				size={MISSION_AVATAR_SIZE}
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="flex h-5 items-center gap-1.5">
					<span
						className={cn(
							"min-w-0 flex-1 truncate text-sm",
							isTitleMuted
								? "text-muted-foreground"
								: "font-medium text-foreground",
						)}
					>
						{title}
					</span>
					<span className="shrink-0 text-[11px] text-muted-foreground leading-5 tabular-nums">
						{timestamp}
					</span>
				</span>
				<span className="flex h-4 items-center gap-[5px] text-muted-foreground text-xs">
					<Mark aria-hidden="true" className="size-[11px] shrink-0" />
					{identifier ? (
						<span className="shrink-0 font-medium tabular-nums">
							{identifier}
						</span>
					) : null}
					<span className="min-w-0 truncate" data-slot="activity-row-parts">
						{written.map((part, index) => (
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
			{spokenState ? <span className="sr-only">{spokenState}</span> : null}
		</>
	)

	return (
		<li data-slot={slot}>
			{activation ? (
				<button
					className={cn(ROW_CLASS, ACTIVATION_CLASS)}
					data-opens={activation.id}
					onClick={activation.onOpen}
					type="button"
				>
					{content}
				</button>
			) : (
				<div className={ROW_CLASS}>{content}</div>
			)}
		</li>
	)
}

export {
	ACTIVATION_CLASS,
	ActivityRow,
	type ActivityRowActivation,
	type ActivityRowPart,
	type ActivityRowProps,
	ROW_CLASS,
}
