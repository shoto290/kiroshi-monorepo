import type { ReactNode } from "react"

import { Notice } from "@workspace/ui/components/notice"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import { describeAttachmentError } from "@/lib/chat/attachments"
import type { AttachmentStoreError } from "@/lib/chat/attachments-contract"
import type { UnresolvedMention } from "@/lib/conversations/conversation-controller"
import { mentionTokenOf } from "@/lib/conversations/mentions"

type ThreadNoticeProps = {
	refusal: AttachmentStoreError | null
	onDismissRefusal: () => void
	children?: ReactNode
}

export const ThreadNotice = ({
	refusal,
	onDismissRefusal,
	children,
}: ThreadNoticeProps) => {
	const t = useChatCopy()

	if (!refusal) {
		return <>{children}</>
	}

	return (
		<Notice
			description={describeAttachmentError(t, refusal)}
			onDismiss={onDismissRefusal}
			title={t("screen.attachmentsRefused")}
			tone="warning"
		/>
	)
}

type PinsNoticeProps = {
	onDismiss: () => void
}

export const PinsNotice = ({ onDismiss }: PinsNoticeProps) => {
	const t = useChatCopy()

	return (
		<Notice
			description={t("pinned.unavailable.description")}
			onDismiss={onDismiss}
			title={t("pinned.unavailable.title")}
			tone="warning"
		/>
	)
}

type UnresolvedMentionsNoticeProps = {
	mentions: UnresolvedMention[]
	onDismiss: () => void
}

const labelOf = ({ botId, name }: UnresolvedMention) =>
	name ?? mentionTokenOf(botId)

export const UnresolvedMentionsNotice = ({
	mentions,
	onDismiss,
}: UnresolvedMentionsNoticeProps) => {
	const t = useChatCopy()
	const names = mentions.map(labelOf).join(", ")

	return (
		<Notice
			description={t("transcript.mention.unresolved.description", {
				count: mentions.length,
				names,
			})}
			onDismiss={onDismiss}
			title={t("transcript.mention.unresolved.title", {
				count: mentions.length,
			})}
			tone="warning"
		/>
	)
}
