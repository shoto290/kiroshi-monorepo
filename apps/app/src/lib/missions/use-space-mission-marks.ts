import { useCallback, useEffect, useRef, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { coalescedRead } from "./coalesced-read"
import type { MissionInSpace } from "./mission-contract"
import { missionsTransport } from "./missions-transport"

import { isHostOffline } from "@/lib/host/host-offline"
import { useReachableHost } from "@/lib/host/use-reachable-host"

type HeldMarks = {
	spaceId: string
	host: string
	entries: MissionInSpace[]
}

const NO_MARKS: MissionInSpace[] = []

const raiseUnavailableNotice = () =>
	raiseFailureNotice({
		title: i18n.t("bots:roster.mission.unavailable.title"),
		description: i18n.t("bots:roster.mission.unavailable.description"),
	})

export const useSpaceMissionMarks = (
	spaceId: string | null,
): MissionInSpace[] => {
	const [held, setHeld] = useState<HeldMarks | null>(null)
	const reads = useRef(0)
	const isFailureReported = useRef(false)
	const host = useReachableHost()

	const reload = useCallback(() => {
		reads.current += 1
		if (!spaceId || !host) {
			return
		}

		const ticket = reads.current
		missionsTransport.spaceFeed(spaceId, Date.now()).then(
			(entries) => {
				if (ticket !== reads.current) {
					return
				}
				isFailureReported.current = false
				setHeld({ spaceId, host, entries })
			},
			(reason) => {
				if (ticket !== reads.current) {
					return
				}
				setHeld(null)
				if (isHostOffline(reason) || isFailureReported.current) {
					return
				}
				isFailureReported.current = true
				raiseUnavailableNotice()
			},
		)
	}, [spaceId, host])

	useEffect(reload, [reload])

	useEffect(() => {
		const rereading = coalescedRead(reload)
		const listening = missionsTransport
			.onChanged(rereading.request)
			.catch((reason) => {
				console.error(
					"roster: mission changes could not be listened to",
					reason,
				)
				return () => undefined
			})

		return () => {
			rereading.cancel()
			void listening.then((unsubscribe) => unsubscribe())
		}
	}, [reload])

	const isShown = held?.spaceId === spaceId && held.host === host
	return isShown ? held.entries : NO_MARKS
}
