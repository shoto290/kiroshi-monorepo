"use client"

import { useTranslation } from "react-i18next"

import type { BotBadge, BotMissionTicket } from "@workspace/ui/components/badge"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import {
	MISSION_AVATAR_SIZE,
	type MissionBot,
	type MissionState,
} from "@workspace/ui/components/mission"
import { missionTicketPlatform } from "@workspace/ui/components/mission-marks"
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

const NAMED_STATES: MissionState[] = ["ready_to_merge", "failed", "done"]

const DOT_CLASS = "before:mx-1 before:content-['·']"

const ROW_CLASS =
	"flex min-h-13 w-full items-center gap-2.5 rounded-xl py-1.5 pe-3 ps-1.5 text-start outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"

type MissionRowPart = {
	key: string
	text: string
}

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
	const badge = BADGE_OF[state]
	const stateWord = NAMED_STATES.includes(state)
		? t(`missions.state.${state}`)
		: null
	const parts: MissionRowPart[] = [
		...(isNamed ? [] : [{ key: "ticket", text: ticket.title }]),
		{ key: "bot", text: bot.name },
		...(stateWord ? [{ key: "state", text: stateWord }] : []),
	]

	return (
		<li data-slot="mission-row" data-state={state}>
			<button
				className={ROW_CLASS}
				data-opens={id}
				onClick={onOpen}
				type="button"
			>
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
								state === "done"
									? "text-muted-foreground"
									: "font-medium text-foreground",
							)}
						>
							{objective}
						</span>
						<span className="shrink-0 text-[11px] text-muted-foreground leading-5 tabular-nums">
							{timestamp}
						</span>
					</span>
					<span className="flex h-4 items-center gap-[5px] text-muted-foreground text-xs">
						<Mark aria-hidden="true" className="size-[11px] shrink-0" />
						{isNamed ? (
							<span className="shrink-0 font-medium tabular-nums">
								{ticket.externalId}
							</span>
						) : null}
						<span className="min-w-0 truncate">
							{parts.map((part, index) => (
								<span
									className={index === 0 && !isNamed ? undefined : DOT_CLASS}
									key={part.key}
								>
									{part.text}
								</span>
							))}
						</span>
					</span>
				</span>
				{badge && !stateWord ? (
					<span className="sr-only">{t(`missions.state.${state}`)}</span>
				) : null}
			</button>
		</li>
	)
}

export { MissionRow, type MissionRowModel, type MissionRowProps }
