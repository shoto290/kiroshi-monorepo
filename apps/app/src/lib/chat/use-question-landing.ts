import { type RefObject, useLayoutEffect, useRef } from "react"

import type { TranscriptHandle } from "@workspace/ui/components/transcript"

type QuestionLandingInput = {
	conversationKey: string
	isAsking: boolean
	hasMessages: boolean
	leadId?: string
	scrollerRef: RefObject<TranscriptHandle | null>
}

export const useQuestionLanding = ({
	conversationKey,
	isAsking,
	hasMessages,
	leadId,
	scrollerRef,
}: QuestionLandingInput) => {
	const settledKey = useRef<string | null>(null)

	useLayoutEffect(() => {
		if (settledKey.current === conversationKey) {
			return
		}
		if (!isAsking) {
			if (hasMessages) {
				settledKey.current = conversationKey
			}
			return
		}
		if (
			leadId &&
			scrollerRef.current?.scrollToMessage(leadId, "auto", "start")
		) {
			settledKey.current = conversationKey
		}
	}, [conversationKey, isAsking, hasMessages, leadId, scrollerRef])
}
