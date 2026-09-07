import { useEffect } from "react"

import type { RoutineRowModel } from "@workspace/ui/components/routine-row"

import type { OpenedRoutine } from "./opened-routine-controller"

export type OpenedRoutineRequest = {
	opened: OpenedRoutine | null
	conversationId: string | null
	routines: RoutineRowModel[]
	onOpen: (routineId: string) => void
	onTaken: () => void
}

export const useOpenedRoutine = ({
	opened,
	conversationId,
	routines,
	onOpen,
	onTaken,
}: OpenedRoutineRequest) => {
	useEffect(() => {
		if (!opened || opened.conversationId !== conversationId) {
			return
		}
		if (!routines.some((routine) => routine.id === opened.routineId)) {
			return
		}

		onTaken()
		onOpen(opened.routineId)
	}, [opened, conversationId, routines, onOpen, onTaken])
}
