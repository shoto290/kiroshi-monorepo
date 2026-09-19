import { useEffect } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"

import { startCompanionSpokeDriver } from "./companion-spoke-driver"
import type { ConversationRuntimes } from "./conversation-runtimes"
import { arrivalsTransport } from "./store-transport"

export type CompanionSpokeDriverMount = {
	runtimes: ConversationRuntimes
}

export const useCompanionSpokeDriver = ({
	runtimes,
}: CompanionSpokeDriverMount) => {
	useEffect(
		() =>
			startCompanionSpokeDriver({
				runtimes,
				companions: arrivalsTransport,
				reportFailure: raiseFailureNotice,
			}),
		[runtimes],
	)
}
