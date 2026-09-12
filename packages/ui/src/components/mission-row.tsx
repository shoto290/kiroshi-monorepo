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
	const hasTicket = isTicketed(ticket)
	const parts = [
		...(hasTicket
			? [
					{
						key: "ticket",
						text: isNamed ? ticket.externalId : ticket.title,
					},
				]
			: []),
		{ key: "bot", text: bot.name },
		{ key: "state", text: t(`missions.state.${state}`) },
	].filter((part) => part.text !== "")

	return (
		<li data-slot="mission-row">
			<SidebarListRow
				badge={BADGE_OF[state]}
				data-opens={id}
				isNameMuted={state === "done"}
				isWorking={state === "working"}
				media={
					<BotIdentityAvatar
						{...bot}
						kind="working"
						size={MISSION_AVATAR_SIZE}
						working={state === "working"}
					/>
				}
				name={objective}
				onSelect={onOpen}
				preview={
					<>
						{hasTicket ? (
							<Mark aria-hidden="true" className={MARK_CLASS} />
						) : null}
						{parts.map((part, index) => (
							<span
								className={index === 0 ? undefined : DOT_CLASS}
								key={part.key}
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
