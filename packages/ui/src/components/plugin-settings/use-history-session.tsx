"use client"

import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import type { BotIdentity } from "@workspace/ui/components/bot-settings"
import { HistoryChangePage } from "@workspace/ui/components/plugin-settings/history-change-page"
import {
	type HistoryChange,
	HistoryPanel,
	type PluginHistory,
} from "@workspace/ui/components/plugin-settings/history-panel"

const HISTORY_TAB = "history"

type HistorySessionProps = {
	history?: PluginHistory
	companionName: string
	companion?: BotIdentity
	readerImage?: string
}

type HistorySession = {
	panel: ReactNode
	page: ReactNode
	discard: () => void
}

const useHistorySession = ({
	history,
	companionName,
	companion,
	readerImage,
}: HistorySessionProps): HistorySession => {
	const { t } = useTranslation("bots")
	const [opened, setOpened] = useState<HistoryChange | null>(null)

	const open = (change: HistoryChange) => {
		setOpened(change)
		history?.onOpen?.(change)
	}

	const close = () => setOpened(null)

	const dateOf = (change: HistoryChange) => {
		const day = history?.days.find((it) =>
			it.changes.some((candidate) => candidate.id === change.id),
		)

		return day
			? t("history.change.date", { day: day.label, time: change.time })
			: change.time
	}

	const pageFor = (change: HistoryChange, opening: PluginHistory) => (
		<HistoryChangePage
			areFilesReading={opening.areFilesReading}
			author={
				change.author === "bot" ? companionName : t("history.author.user")
			}
			date={dateOf(change)}
			files={opening.files ?? []}
			haveFilesFailedToRead={opening.haveFilesFailedToRead}
			onBack={close}
			onUndo={() => opening.onUndo(change)}
			reason={change.detail}
			retouchCount={change.retouchCount}
			title={change.sentence}
		/>
	)

	return {
		panel: history ? (
			<HistoryPanel
				{...history}
				companion={companion}
				companionName={companionName}
				onOpen={open}
				readerImage={readerImage}
			/>
		) : null,
		page: history && opened ? pageFor(opened, history) : null,
		discard: close,
	}
}

export {
	HISTORY_TAB,
	type HistorySession,
	type HistorySessionProps,
	useHistorySession,
}
