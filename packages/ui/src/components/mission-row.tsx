"use client"

import { useTranslation } from "react-i18next"

import { DOT_CLASS } from "@workspace/ui/components/activity-row"
import type {
	BotBadge,
	BotMissionTicket,
} from "@workspace/ui/components/bot-badge"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import {
	MISSION_AVATAR_SIZE,
	type MissionBot,
	type MissionState,
} from "@workspace/ui/components/mission"
import { missionTicketPlatform } from "@workspace/ui/components/mission-marks"
import { SidebarListRow } from "@workspace/ui/components/sidebar-list-row"
import { cn } from "@workspace/ui/lib/utils"

type MissionRowModel = {
	id: string
	objective: string
	ticket: BotMissionTicket
	bot: MissionBot
	state: MissionState
	timestamp: string
}

type MissionRowProps = MissionRowModel & {
	onOpen: () => void
}

const BADGE_OF: Partial<Record<MissionState, BotBadge>> = {
	waiting_human: "attention",
	ready_to_merge: "done",
	failed: "failed",
}

const MARK_CLASS =
	"me-[5px] inline-block size-[11px]! align-[-1px] text-muted-foreground"

const IDENTIFIER_CLASS = "font-medium tabular-nums"

const isTicketed = ({ platform, externalId, title }: BotMissionTicket) =>
	Boolean(platform || externalId || title)

const MissionRow = ({
	id,
	objective,
	ticket,
	bot,
	state,
	timestamp,
	onOpen,
}: MissionRowProps) => {
	const { t } = useTranslation("chat")
	const { Mark, isNamed } = missionTicketPlatform(ticket.platform)
	const isWorking = state === "working"
	const parts = [
		{
			slot: "ticket",
			text: isNamed ? ticket.externalId : ticket.title,
			className: isNamed ? IDENTIFIER_CLASS : undefined,
		},
		{ slot: "bot", text: bot.name },
		{ slot: "state", text: t(`missions.state.${state}`) },
	].filter((part) => part.text !== "")

	return (
		<li data-slot="mission-row">
			<SidebarListRow
				badge={BADGE_OF[state]}
				data-opens={id}
				isNameMuted={state === "done"}
				isWorking={isWorking}
				media={
					<BotIdentityAvatar
						{...bot}
						kind="working"
						size={MISSION_AVATAR_SIZE}
						working={isWorking}
					/>
				}
				name={objective}
				onSelect={onOpen}
				preview={
					<>
						{isTicketed(ticket) ? (
							<Mark aria-hidden="true" className={MARK_CLASS} />
						) : null}
						{parts.map((part, index) => (
							<span
								className={cn(index > 0 && DOT_CLASS, part.className)}
								data-slot="mission-row-part"
								key={part.slot}
							>
								{part.text}
							</span>
						))}
					</>
				}
				timestamp={timestamp}
			/>
		</li>
	)
}

export { MissionRow, type MissionRowModel, type MissionRowProps }
