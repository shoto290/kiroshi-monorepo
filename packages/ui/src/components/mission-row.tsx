"use client"

import { useTranslation } from "react-i18next"

import {
	ActivityRow,
	type ActivityRowPart,
} from "@workspace/ui/components/activity-row"
import type { BotBadge, BotMissionTicket } from "@workspace/ui/components/badge"
import type { MissionBot, MissionState } from "@workspace/ui/components/mission"
import { missionTicketPlatform } from "@workspace/ui/components/mission-marks"

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
	const parts: ActivityRowPart[] = [
		...(isNamed ? [] : [{ key: "ticket", text: ticket.title }]),
		{ key: "bot", text: bot.name },
		...(stateWord ? [{ key: "state", text: stateWord }] : []),
	]

	return (
		<ActivityRow
			activation={{ id, onOpen }}
			badge={badge}
			bot={bot}
			identifier={isNamed ? ticket.externalId : undefined}
			isTitleMuted={state === "done"}
			mark={Mark}
			parts={parts}
			slot="mission-row"
			spokenState={
				badge && !stateWord ? t(`missions.state.${state}`) : undefined
			}
			timestamp={timestamp}
			title={objective}
		/>
	)
}

export { MissionRow, type MissionRowModel, type MissionRowProps }
