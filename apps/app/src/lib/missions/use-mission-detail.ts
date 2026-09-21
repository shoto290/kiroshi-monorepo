import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { MissionEventModel } from "@workspace/ui/components/mission"

import { coalescedRead } from "./coalesced-read"
import type { Mission } from "./mission-contract"
import { toMissionEventModels, withMissionChange } from "./missions-model"
import { missionsTransport } from "./missions-transport"

type MissionRead = {
	mission: Mission
	events: MissionEventModel[]
	readAt: number
}

export type MissionDetailRead = {
	read: MissionRead | null
	isReading: boolean
	hasFailedToRead: boolean
	onRetry: () => void
}

export const useMissionDetail = (missionId: string): MissionDetailRead => {
	const [read, setRead] = useState<MissionRead | null>(null)
	const [isReading, setReading] = useState(true)
	const [hasFailedToRead, setFailedToRead] = useState(false)
	const reads = useRef(0)

	const fetchMission = useCallback(() => {
		reads.current += 1
		const ticket = reads.current

		void missionsTransport.detail(missionId).then(
			(detail) => {
				if (ticket !== reads.current) return
				setRead({
					mission: detail.mission,
					events: toMissionEventModels(detail.events),
					readAt: Date.now(),
				})
				setReading(false)
				setFailedToRead(false)
			},
			() => {
				if (ticket !== reads.current) return
				setReading(false)
				setFailedToRead(true)
			},
		)
	}, [missionId])

	const readMission = useCallback(() => {
		setReading(true)
		fetchMission()
	}, [fetchMission])

	useEffect(() => {
		setRead(null)
		readMission()
	}, [readMission])

	useEffect(() => {
		const rereading = coalescedRead(fetchMission)
		const listening = missionsTransport
			.onChanged((changed) => {
				if (changed.missionId !== missionId) return
				setRead((held) =>
					held
						? { ...held, mission: withMissionChange(held.mission, changed) }
						: held,
				)
				rereading.request()
			})
			.catch((reason) => {
				console.error(
					"mission thread: mission changes could not be listened to",
					reason,
				)
				return () => undefined
			})

		return () => {
			rereading.cancel()
			void listening.then((unsubscribe) => unsubscribe())
		}
	}, [missionId, fetchMission])

	return useMemo(
		() => ({ read, isReading, hasFailedToRead, onRetry: readMission }),
		[read, isReading, hasFailedToRead, readMission],
	)
}
