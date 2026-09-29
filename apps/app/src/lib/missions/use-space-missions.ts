import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { coalescedRead } from "./coalesced-read"
import type { MissionChanged, MissionInSpace } from "./mission-contract"
import {
	type SpaceMissionGroups,
	startOfLocalDay,
	toSpaceMissionGroups,
	withMissionMove,
} from "./missions-model"
import { missionsTransport } from "./missions-transport"

type HeldSpaceMissions = {
	spaceId: string
	closedSince: number
	entries: MissionInSpace[]
}

const NO_GROUPS: SpaceMissionGroups = {
	waitingOnYou: [],
	inProgress: [],
	earlierToday: [],
}

const withChangeApplied =
	(changed: MissionChanged) =>
	(held: HeldSpaceMissions | null): HeldSpaceMissions | null =>
		held?.entries.some(({ mission }) => mission.id === changed.missionId)
			? {
					...held,
					entries: held.entries.map((entry) =>
						entry.mission.id === changed.missionId
							? { ...entry, mission: withMissionMove(entry.mission, changed) }
							: entry,
					),
				}
			: held

export type SpaceMissionsView = SpaceMissionGroups & {
	waitingCount: number
	hasFailed: boolean
	reload: () => void
}

export const useSpaceMissions = (spaceId: string | null): SpaceMissionsView => {
	const [held, setHeld] = useState<HeldSpaceMissions | null>(null)
	const [failedSpaceId, setFailedSpaceId] = useState<string | null>(null)
	const reads = useRef(0)

	const reload = useCallback(() => {
		reads.current += 1
		if (!spaceId) {
			return
		}

		const ticket = reads.current
		const closedSince = startOfLocalDay(Date.now())

		missionsTransport.spaceFeed(spaceId, closedSince).then(
			(entries) => {
				if (ticket !== reads.current) {
					return
				}

				setHeld({ spaceId, closedSince, entries })
				setFailedSpaceId(null)
			},
			() => {
				if (ticket === reads.current) {
					setFailedSpaceId(spaceId)
				}
			},
		)
	}, [spaceId])

	useEffect(reload, [reload])

	useEffect(() => {
		const rereading = coalescedRead(reload)
		const applyChange = (changed: MissionChanged) => {
			setHeld(withChangeApplied(changed))
			rereading.request()
		}
		const listening = missionsTransport
			.onChanged(applyChange)
			.catch((reason) => {
				console.error(
					"missions tab: mission changes could not be listened to",
					reason,
				)
				return () => undefined
			})

		return () => {
			rereading.cancel()
			void listening.then((unsubscribe) => unsubscribe())
		}
	}, [reload])

	const groups = useMemo(
		() =>
			spaceId !== null && held?.spaceId === spaceId
				? toSpaceMissionGroups(held)
				: NO_GROUPS,
		[spaceId, held],
	)
	const hasFailed = spaceId !== null && failedSpaceId === spaceId

	return useMemo(
		() => ({
			...groups,
			waitingCount: groups.waitingOnYou.length,
			hasFailed,
			reload,
		}),
		[groups, hasFailed, reload],
	)
}
