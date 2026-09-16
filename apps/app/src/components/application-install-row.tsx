import {
	ApplicationCard,
	type ApplicationCardStatus,
} from "@workspace/ui/components/application-card"
import { Icons } from "@workspace/ui/components/icons"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import { ToolQuestion } from "@workspace/ui/components/tool-question"
import { type ChatCopy, useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type {
	Application,
	ApplicationInstall,
	InstallCase,
} from "@/lib/applications/application-port"

const RECEIPT_STATUS = {
	nothing: "connected",
	key: "apiKey",
	oauth: "signIn",
} as const satisfies Record<InstallCase["kind"], ApplicationCardStatus>

type ApplicationInstallRowProps = {
	install: ApplicationInstall
	curated: Application | undefined
	destinationName: string | undefined
	isLeftOut: boolean
	onOpenSettings: () => void
}

type LeftOutKeyProps = {
	title: string
	secrets: string[]
	onOpenSettings: () => void
}

const receiptSentenceOf = (
	t: ChatCopy,
	{ scope, title }: ApplicationInstall,
	destinationName: string | undefined,
) => {
	if (scope === "user") {
		return t("applicationInstall.receipt.user", { name: title })
	}
	const destination = destinationName ?? ""
	if (scope === "space") {
		return t("applicationInstall.receipt.space", { name: title, destination })
	}
	return t("applicationInstall.receipt.companion", { name: title, destination })
}

const LeftOutKey = ({ title, secrets, onOpenSettings }: LeftOutKeyProps) => {
	const t = useChatCopy()

	return (
		<MessageBubble>
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

export const ApplicationInstallRow = ({
	install,
	curated,
	destinationName,
	isLeftOut,
	onOpenSettings,
}: ApplicationInstallRowProps) => {
	const t = useChatCopy()

	return (
		<Message from="assistant">
			<MessageContent>
				{isLeftOut && install.install.kind === "key" ? (
					<LeftOutKey
						onOpenSettings={onOpenSettings}
						secrets={install.install.secrets}
						title={install.title}
					/>
				) : null}
				<ApplicationCard
					description={curated?.description ?? ""}
					displayName={curated ? install.title : undefined}
					footnote={{
						sentence: receiptSentenceOf(t, install, destinationName),
						actionLabel: t("applicationInstall.openSettings"),
						onAction: onOpenSettings,
					}}
					mark={install.logo ?? curated?.logo}
					name={install.application}
					status={RECEIPT_STATUS[install.install.kind]}
				/>
			</MessageContent>
		</Message>
	)
}
