import { useCallback, useEffect, useRef, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { coalescedRead } from "./coalesced-read"
import type { MissionOnBoard } from "./mission-contract"
import { missionsTransport } from "./missions-transport"

import { isHostOffline } from "@/lib/host/host-offline"
import { LOCAL_HOST, useReachableHost } from "@/lib/host/use-reachable-host"

export type MissionMark = Pick<MissionOnBoard, "mission">

type HeldMarks = {
	source: string
	entries: MissionMark[]
}

type MarksRead = {
	source: string
	read: () => Promise<MissionMark[]>
}

const NO_MARKS: MissionMark[] = []

const marksReadOf = (
	host: string | null,
	spaceId: string | null,
): MarksRead | null => {
	if (host === LOCAL_HOST) {
		return { source: LOCAL_HOST, read: missionsTransport.board }
	}
	if (!host || !spaceId) {
		return null
	}
	return {
		source: `${host}/${spaceId}`,
		read: () => missionsTransport.spaceFeed(spaceId, Date.now()),
	}
}

const raiseUnavailableNotice = () =>
	raiseFailureNotice({
		title: i18n.t("bots:roster.mission.unavailable.title"),
		description: i18n.t("bots:roster.mission.unavailable.description"),
	})

export const useMissionMarks = (shownSpaceId: string | null): MissionMark[] => {
	const [held, setHeld] = useState<HeldMarks | null>(null)
	const reads = useRef(0)
	const isFailureReported = useRef(false)
	const host = useReachableHost()

	const reload = useCallback(() => {
		reads.current += 1
		const marksRead = marksReadOf(host, shownSpaceId)
		if (!marksRead) {
			return
		}

		const ticket = reads.current
		const { source, read } = marksRead
		read().then(
			(entries) => {
				if (ticket !== reads.current) {
					return
				}
				isFailureReported.current = false
				setHeld({ source, entries })
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
	}, [host, shownSpaceId])

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

	const isShown =
		held !== null && held.source === marksReadOf(host, shownSpaceId)?.source
	return isShown ? held.entries : NO_MARKS
}
