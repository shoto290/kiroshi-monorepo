import { useEffect } from "react"

import { listen, onHostReconnected } from "../host"

const ROSTER_CHANGED_EVENTS = [
	"conversation://created",
	"conversation://updated",
	"conversation://deleted",
	"companion://updated",
	"companion://deleted",
]

const listenToRosterChanges = async (reload: () => void) => {
	const unlistens = await Promise.all(
		ROSTER_CHANGED_EVENTS.map((event) => listen(event, () => reload())),
	)
	return () => {
		for (const unlisten of unlistens) {
			unlisten()
		}
	}
}

export const useRosterReloads = (reload: () => void) => {
	useEffect(() => {
		const listening = listenToRosterChanges(reload).catch((reason) => {
			console.error("roster: roster changes could not be listened to", reason)
			return () => undefined
		})
		const stopReconnections = onHostReconnected(reload)
		return () => {
			stopReconnections()
			void listening.then((unlisten) => unlisten())
		}
	}, [reload])
}
