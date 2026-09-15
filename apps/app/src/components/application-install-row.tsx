import {
	ApplicationCard,
	type ApplicationCardProps,
} from "@workspace/ui/components/application-card"
import {
	ApplicationInstall as ApplicationInstallBubble,
	type ApplicationInstallControl,
} from "@workspace/ui/components/application-install"
import { Icons } from "@workspace/ui/components/icons"
import {
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import {
	ToolQuestion,
	type ToolQuestionAction,
} from "@workspace/ui/components/tool-question"
import { AssistantTurn } from "@workspace/ui/components/turn"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type {
	Application,
	ApplicationInstall,
} from "@/lib/applications/application-port"

type InstalledCard = Omit<ApplicationCardProps, "footnote" | "status">

type ApplicationInstallRowProps = {
	install: ApplicationInstall
	curated: Application | undefined
	isLeftOut: boolean
	onOpenSettings: () => void
}

const cardOf = (
	install: ApplicationInstall,
	curated: Application | undefined,
): InstalledCard => ({
	name: install.application,
	displayName: curated ? install.title : undefined,
	mark: install.logo ?? curated?.logo,
	description: curated?.description ?? "",
})

const InstallPiece = ({
	install,
	curated,
	isLeftOut,
	onOpenSettings,
}: ApplicationInstallRowProps) => {
	const t = useChatCopy()
	const card = cardOf(install, curated)
	const openSettings: ToolQuestionAction = {
		label: t("applicationInstall.openSettings"),
		icon: Icons.Settings,
		onSelect: onOpenSettings,
	}
	const leading: ApplicationInstallControl = {
		...openSettings,
		emphasis: "primary",
	}

	if (install.install.kind === "nothing") {
		return <ApplicationCard {...card} status="connected" />
	}

	if (install.install.kind === "oauth") {
		return (
			<ApplicationInstallBubble
				application={{ ...card, status: "signIn" }}
				leading={leading}
			/>
		)
	}

	const secret = t("applicationInstall.secret", {
		secret: install.install.secret,
	})

	if (isLeftOut) {
		return (
			<MessageBubble>
				<MessageBubbleContent>
					<ToolQuestion
						questions={[
							{
								isNotice: true,
								header: install.title,
								failure: {
									title: t("applications.connection.session.title", {
										ns: "bots",
										name: install.title,
									}),
									detail: secret,
								},
								action: openSettings,
							},
						]}
					/>
				</MessageBubbleContent>
			</MessageBubble>
		)
	}

	return (
		<ApplicationInstallBubble
			application={{ ...card, description: secret, status: "apiKey" }}
			leading={leading}
		/>
	)
}

export const ApplicationInstallRow = (props: ApplicationInstallRowProps) => (
	<AssistantTurn bare>
		<InstallPiece {...props} />
	</AssistantTurn>
)
