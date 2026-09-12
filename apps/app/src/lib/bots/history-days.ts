import type {
	HistoryChange,
	HistoryDay,
} from "@workspace/ui/components/plugin-settings/history-panel"

import type { BotCommit } from "./history-controller"

const LOCALE = "en-US"

const DAY = new Intl.DateTimeFormat(LOCALE, {
	weekday: "long",
	month: "long",
	day: "numeric",
})

const FULL_DATE = new Intl.DateTimeFormat(LOCALE, {
	year: "numeric",
	month: "long",
	day: "numeric",
})

const TIME = new Intl.DateTimeFormat(LOCALE, {
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
})

const toChange = (commit: BotCommit): HistoryChange => ({
	id: commit.id,
	author: commit.author,
	sentence: commit.title,
	detail: commit.body || undefined,
	at: new Date(commit.timestamp * 1000).toISOString(),
	time: TIME.format(commit.timestamp * 1000),
})

export const toHistoryDays = (commits: BotCommit[]): HistoryDay[] => {
	const days: HistoryDay[] = []

	for (const commit of [...commits].sort((a, b) => b.timestamp - a.timestamp)) {
		const at = commit.timestamp * 1000
		const id = new Date(at).toISOString().slice(0, 10)
		const last = days.at(-1)

		if (last?.id === id) last.changes.push(toChange(commit))
		else days.push({ id, label: DAY.format(at), changes: [toChange(commit)] })
	}

	return days
}

export const oldestHistoryDate = (commits: BotCommit[]): string => {
	const oldest = Math.min(...commits.map((commit) => commit.timestamp))

	return commits.length === 0 ? "" : FULL_DATE.format(oldest * 1000)
}
