import { useMemo } from "react"

import type { CompanionSelect } from "@workspace/ui/components/companion-select"

type RosterMember = { id: string }

export type CompanionSelectSource = {
	rosters: Record<string, RosterMember[]>
	openSpaceId: string | null
	select: (companionId: string) => void
	leaveMission: () => void
}

const NO_COMPANION_SELECT: CompanionSelect = () => undefined

export const useCompanionSelectGuard = ({
	rosters,
	openSpaceId,
	select,
	leaveMission,
}: CompanionSelectSource): CompanionSelect =>
	useMemo(() => {
		if (!openSpaceId) return NO_COMPANION_SELECT

		const members = rosters[openSpaceId] ?? []

		return (companionId: string) => {
			if (members.some((member) => member.id === companionId)) {
				leaveMission()
				select(companionId)
			}
		}
	}, [rosters, openSpaceId, select, leaveMission])
