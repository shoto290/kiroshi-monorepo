import type {
	HistoryChange,
	HistoryDay,
} from "@workspace/ui/components/plugin-settings/history-panel"
import { i18n } from "@workspace/ui/lib/i18n"

import type { BotCommit } from "./history-controller"

const format = (options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat(i18n.language, options)

const dayKeyOf = (at: Date) =>
	`${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`

const dayBefore = (now: Date) => {
	const before = new Date(now)
	before.setDate(now.getDate() - 1)
	return before
}

const dayLabelOf = (at: Date, now: Date) => {
	if (dayKeyOf(at) === dayKeyOf(now)) return i18n.t("bots:history.day.today")
	if (dayKeyOf(at) === dayKeyOf(dayBefore(now)))
		return i18n.t("bots:history.day.yesterday")

	return format({ day: "numeric", month: "long" }).format(at)
}

const toChange = (commit: BotCommit, at: Date): HistoryChange => ({
	id: commit.id,
	author: commit.author,
	sentence: commit.title,
	detail: commit.body || undefined,
	at: at.toISOString(),
	time: format({ hour: "2-digit", minute: "2-digit", hour12: false }).format(
		at,
	),
})

export const toHistoryDays = (
	commits: BotCommit[],
	now = new Date(),
): HistoryDay[] => {
	const days: HistoryDay[] = []

	for (const commit of [...commits].sort((a, b) => b.timestamp - a.timestamp)) {
		const at = new Date(commit.timestamp * 1000)
		const id = dayKeyOf(at)
		const last = days.at(-1)

		if (last?.id === id) last.changes.push(toChange(commit, at))
		else
			days.push({
				id,
				label: dayLabelOf(at, now),
				changes: [toChange(commit, at)],
			})
	}

	return days
}

export const oldestHistoryDate = (commits: BotCommit[]): string => {
	if (commits.length === 0) return ""

	const oldest = Math.min(...commits.map((commit) => commit.timestamp))

	return format({ year: "numeric", month: "long", day: "numeric" }).format(
		oldest * 1000,
	)
}
