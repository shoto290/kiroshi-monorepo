"use client"

import {
	ApplicationCard,
	type ApplicationCardProps,
} from "@workspace/ui/components/application-card"
import { Icons } from "@workspace/ui/components/icons"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
	MESSAGE_BUBBLE_MAX_INLINE_SIZE,
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import { ToolQuestion } from "@workspace/ui/components/tool-question"
import { TURN_AVATAR_SIZE } from "@workspace/ui/components/turn"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"
import { cn } from "@workspace/ui/lib/utils"

type ApplicationInstallNotice = {
	title: string
	secrets: string[]
	onOpenSettings: () => void
}

type ApplicationInstallTurnProps = {
	receipt: ApplicationCardProps
	notice?: ApplicationInstallNotice
}

const LeftOutKeyNotice = ({
	title,
	secrets,
	onOpenSettings,
}: ApplicationInstallNotice) => {
	const t = useChatCopy()

	return (
		<MessageBubble className="col-start-2 row-start-1">
			<MessageBubbleContent>
				<ToolQuestion
					questions={[
						{
							isNotice: true,
							header: title,
							failure: {
								title: t("applications.connection.session.title", {
									ns: "bots",
									name: title,
								}),
								detail: t("applicationInstall.secret", {
									count: secrets.length,
									secret: secrets.join(", "),
								}),
							},
							action: {
								label: t("applicationInstall.openSettings"),
								icon: Icons.Settings,
								onSelect: onOpenSettings,
							},
						},
					]}
				/>
			</MessageBubbleContent>
		</MessageBubble>
	)
}

const ApplicationInstallTurn = ({
	receipt,
	notice,
}: ApplicationInstallTurnProps) => (
	<Message from="assistant">
		<MessageContent
			className="grid gap-x-2"
			style={{ gridTemplateColumns: `${TURN_AVATAR_SIZE}px 1fr` }}
		>
			{notice ? <LeftOutKeyNotice {...notice} /> : null}
			<span
				aria-hidden="true"
				className="col-start-1 row-start-2"
				data-slot="message-gutter"
			/>
			<div
				className={cn(
					"col-start-2 row-start-2 min-w-0",
					MESSAGE_BUBBLE_MAX_INLINE_SIZE,
				)}
			>
				<ApplicationCard {...receipt} />
			</div>
		</MessageContent>
	</Message>
)

export {
	type ApplicationInstallNotice,
	ApplicationInstallTurn,
	type ApplicationInstallTurnProps,
}
