import type {
	AppSidebarBot,
	AppSidebarConversation,
	AppSidebarRowMission,
	AppSidebarSection,
} from "@workspace/ui/components/app-sidebar"

import { isPinnedRow, pinsOf } from "./roster-pins"

export type DisplayedRoster = {
	bots: AppSidebarBot[]
	conversations: AppSidebarConversation[]
	sections: AppSidebarSection[]
	collapsedSectionIds: string[]
}

type DisplayedRow = AppSidebarBot | AppSidebarConversation

const NO_ACTIVITY = -1

const byMostRecent = (one: DisplayedRow, other: DisplayedRow) =>
	(other.lastActivityAt ?? NO_ACTIVITY) - (one.lastActivityAt ?? NO_ACTIVITY)

const isWaiting = ({ missions }: { missions?: AppSidebarRowMission[] }) =>
	missions?.some(({ state }) => state === "waiting") ?? false

const topPinnedRowId = ({
	bots,
	conversations,
	sections,
	collapsedSectionIds,
}: DisplayedRoster) => {
	const sectionIds = new Set(sections.map(({ id }) => id))
	const hiddenSectionIds = new Set(collapsedSectionIds)
	const shownPin = pinsOf({ rows: [...conversations, ...bots], sections }).find(
		({ id, sectionId }) =>
			!sectionIds.has(id) &&
			(sectionId === null || !hiddenSectionIds.has(sectionId)),
	)
	return shownPin?.id ?? null
}

const topSortedRowId = ({ bots, conversations }: DisplayedRoster) => {
	const sorted = [...conversations, ...bots]
		.filter((row) => !isPinnedRow(row))
		.toSorted(byMostRecent)
	return (sorted.find(isWaiting) ?? sorted[0])?.id ?? null
}

export const topRowIdOf = (roster: DisplayedRoster) =>
	topPinnedRowId(roster) ?? topSortedRowId(roster)
