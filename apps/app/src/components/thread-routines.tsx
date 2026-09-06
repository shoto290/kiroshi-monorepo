import { type ReactNode, useMemo } from "react"

import {
	type RoutinesFailure,
	RoutinesPanel,
} from "@workspace/ui/components/routines-panel"

import { useRosterClock } from "@/lib/bots/use-roster-clock"
import type { ThreadNaming } from "@/lib/chat/use-thread-roster"
import { toMissionRows } from "@/lib/missions/missions-model"
import type { ConversationMissionsRead } from "@/lib/missions/use-missions"
import { useRoutines } from "@/lib/routines/use-routines"

type ActivityPanel = {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

type ThreadRoutinesProps = {
	activityPanel: ActivityPanel
	conversationId: string | null
	leadBotId?: string
	missions: ConversationMissionsRead
	faceOf: ThreadNaming["faceOf"]
	onOpenMission: (missionId: string) => void
	children: ReactNode
}

const activityFailure = (
	routines: RoutinesFailure | null,
	hasMissionsFailed: boolean,
): RoutinesFailure | null => {
	if (!hasMissionsFailed) {
		return routines
	}

	return routines === "routines" ? "activity" : "missions"
}

const ThreadRoutines = ({
	activityPanel,
	conversationId,
	leadBotId,
	missions,
	faceOf,
	onOpenMission,
	children,
}: ThreadRoutinesProps) => {
	const now = useRosterClock()
	const { routines, failure, reload, setEnabled, remove, form, detail } =
		useRoutines(conversationId, leadBotId)
	const rows = useMemo(
		() =>
			toMissionRows({
				open: missions.open,
				closed: missions.closed,
				faceOf,
				now,
			}),
		[missions.open, missions.closed, faceOf, now],
	)

	const reloadActivity = () => {
		reload()
		missions.reload()
	}

	return (
		<RoutinesPanel
			detail={detail}
			failure={activityFailure(failure, missions.hasFailed)}
			form={form}
			isOpen={activityPanel.isOpen}
			missions={{ ...rows, onOpen: onOpenMission }}
			onDelete={remove}
			onEnabledChange={setEnabled}
			onOpenChange={activityPanel.onOpenChange}
			onRetry={reloadActivity}
			routines={routines}
		>
			{children}
		</RoutinesPanel>
	)
}

export { type ActivityPanel, ThreadRoutines, type ThreadRoutinesProps }
