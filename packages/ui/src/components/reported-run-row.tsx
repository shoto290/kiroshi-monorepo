"use client"

import { useTranslation } from "react-i18next"

import {
	ActivityRow,
	type ActivityRowPart,
} from "@workspace/ui/components/activity-row"
import { Icons } from "@workspace/ui/components/icons"
import type { MissionBot } from "@workspace/ui/components/mission"

type ReportedRunRowModel = {
	id: string
	routineTitle: string
	triggerSourceTitle: string
	bot: MissionBot
	timestamp: string
}

const ReportedRunRow = ({
	routineTitle,
	triggerSourceTitle,
	bot,
	timestamp,
}: ReportedRunRowModel) => {
	const { t } = useTranslation("chat")
	const parts: ActivityRowPart[] = [
		{ key: "source", text: triggerSourceTitle },
		{ key: "bot", text: bot.name },
		{ key: "reported", text: t("activity.runs.reported") },
	]

	return (
		<ActivityRow
			bot={bot}
			mark={Icons.Routine}
			parts={parts}
			slot="reported-run-row"
			timestamp={timestamp}
			title={routineTitle}
		/>
	)
}

export { ReportedRunRow, type ReportedRunRowModel }
