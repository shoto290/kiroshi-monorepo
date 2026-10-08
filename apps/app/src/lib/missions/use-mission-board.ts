import { useCallback, useEffect, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type { MissionOnBoard } from "./mission-contract"
import { missionsTransport } from "./missions-transport"

import { isHostOffline } from "@/lib/host/host-offline"

const NO_BOARD: MissionOnBoard[] = []

export const useMissionBoard = (): MissionOnBoard[] => {
	const [driving, setDriving] = useState<MissionOnBoard[]>(NO_BOARD)

	const read = useCallback(() => {
		void missionsTransport.board().then(
			(board) => setDriving(board),
			(reason) => {
				setDriving(NO_BOARD)
				if (isHostOffline(reason)) {
					return
				}
				raiseFailureNotice({
					title: i18n.t("bots:roster.mission.unavailable.title"),
					description: i18n.t("bots:roster.mission.unavailable.description"),
				})
			},
		)
	}, [])

	useEffect(() => {
		read()
		const listening = missionsTransport.onChanged(read).catch((reason) => {
			console.error("roster: mission changes could not be listened to", reason)
			return () => undefined
		})

		return () => {
			void listening.then((unsubscribe) => unsubscribe())
		}
	}, [read])

	return driving
}
