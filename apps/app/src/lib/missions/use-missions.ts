import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { Mission, MissionChanged } from "./mission-contract"
import { withMissionChange } from "./missions-model"
import { missionsTransport } from "./missions-transport"

const NO_MISSIONS: Mission[] = []

const withChangeApplied =
	(changed: MissionChanged) =>
	(held: Mission[]): Mission[] =>
		held.some(({ id }) => id === changed.missionId)
			? held.map((mission) =>
					mission.id === changed.missionId
						? withMissionChange(mission, changed)
						: mission,
				)
			: held

export type ConversationMissionsRead = {
	open: Mission[]
	closed: Mission[]
	missions: Mission[]
	hasFailed: boolean
	reload: () => void
}

export const useMissions = (
	conversationId: string | null,
): ConversationMissionsRead => {
	const [running, setRunning] = useState<Mission[]>(NO_MISSIONS)
	const [closed, setClosed] = useState<Mission[]>(NO_MISSIONS)
	const [hasFailed, setFailed] = useState(false)
	const reads = useRef(0)

	const reload = useCallback(() => {
		if (!conversationId) {
			return
		}

		reads.current += 1
		const ticket = reads.current

		missionsTransport.list(conversationId).then(
			(listed) => {
				if (ticket !== reads.current) {
					return
				}

				setRunning(listed.open)
				setClosed(listed.done)
				setFailed(false)
			},
			() => {
				if (ticket === reads.current) {
					setFailed(true)
				}
			},
		)
	}, [conversationId])

	useEffect(reload, [reload])

	useEffect(() => {
		const applyChange = (changed: MissionChanged) => {
			setRunning(withChangeApplied(changed))
			setClosed(withChangeApplied(changed))
			reload()
		}
		const listening = missionsTransport
			.onChanged(applyChange)
			.catch((reason) => {
				console.error(
					"activity panel: mission changes could not be listened to",
					reason,
				)
				return () => undefined
			})

		return () => {
			void listening.then((unsubscribe) => unsubscribe())
		}
	}, [reload])

	const missions = useMemo(() => [...running, ...closed], [running, closed])

	return useMemo(
		() => ({
			open: running,
			closed,
			missions,
			hasFailed,
			reload,
		}),
		[running, closed, missions, hasFailed, reload],
	)
}
