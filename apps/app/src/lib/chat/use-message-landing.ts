import { useEffect, useRef, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { TranscriptMessage } from "@/lib/conversations/transcript-contract"
import type { MessageLanding } from "@/lib/search/message-landing-controller"

export type MessageLandingRequest = {
	landing: MessageLanding | null
	conversationId: string | null
	messages: TranscriptMessage[]
	landOn: (seq: number) => Promise<void>
	onLand: (messageId: string) => void
	onTaken: () => void
}

export const useMessageLanding = ({
	landing,
	conversationId,
	messages,
	landOn,
	onLand,
	onTaken,
}: MessageLandingRequest) => {
	const t = useChatCopy()
	const requested = useRef<MessageLanding | null>(null)
	const [readMessageId, setReadMessageId] = useState<string | null>(null)

	useEffect(() => {
		if (!landing || landing.conversationId !== conversationId) {
			return
		}
		if (requested.current === landing) {
			return
		}
		requested.current = landing
		landOn(landing.seq).then(
			() => setReadMessageId(landing.messageId),
			() => {
				onTaken()
				raiseFailureNotice({
					title: t("transcript.landing.unavailable.title"),
					description: t("transcript.landing.unavailable.description"),
				})
			},
		)
	}, [landing, conversationId, landOn, onTaken, t])

	useEffect(() => {
		if (readMessageId === null) {
			return
		}
		if (!messages.some((message) => message.id === readMessageId)) {
			return
		}
		setReadMessageId(null)
		onTaken()
		onLand(readMessageId)
	}, [readMessageId, messages, onLand, onTaken])
}
