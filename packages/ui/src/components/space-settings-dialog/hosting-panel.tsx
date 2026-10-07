"use client"

import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Icons } from "@workspace/ui/components/icons"
import { FIELD_LABEL_CLASS } from "@workspace/ui/components/settings-styles"
import {
	SettingsSwitch,
	type SettingsSwitchStatus,
} from "@workspace/ui/components/settings-switch"
import { Button } from "@workspace/ui/components/ui/button"

type SpaceHosting = "off" | "connecting" | "online" | "signed-out"

type HostingPanelProps = {
	name: string
	hosting: SpaceHosting
	onHost: () => void
	onStopHosting: () => void
	onHostingCancel?: () => void
	onSignIn: () => void
}

type Question = "start" | "stop"

const HostingPanel = ({
	name,
	hosting,
	onHost,
	onStopHosting,
	onHostingCancel,
	onSignIn,
}: HostingPanelProps) => {
	const { t } = useTranslation("settings")
	const [question, setQuestion] = useState<Question | null>(null)
	const isAnswered = useRef(false)

	const answer = (confirm: () => void) => () => {
		isAnswered.current = true
		confirm()
	}

	const close = () => {
		if (!isAnswered.current) {
			onHostingCancel?.()
		}
		isAnswered.current = false
		setQuestion(null)
	}

	if (hosting === "signed-out") {
		return (
			<div className="flex shrink-0 flex-col items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
				<div className="flex flex-col gap-1">
					<p className={FIELD_LABEL_CLASS}>{t("space.hosting.label")}</p>
					<p className="text-muted-foreground text-xs leading-relaxed">
						{t("space.hosting.signedOut")}
					</p>
				</div>
				<Button onClick={onSignIn}>
					{t("space.hosting.signIn")}
					<Icons.ExternalLink data-icon="inline-end" />
				</Button>
			</div>
		)
	}

	const status: Record<"connecting" | "online", SettingsSwitchStatus> = {
		connecting: { tone: "pending", label: t("space.hosting.connecting") },
		online: { tone: "done", label: t("space.hosting.online") },
	}

	return (
		<>
			<SettingsSwitch
				checked={hosting !== "off"}
				description={t("space.hosting.description", { name })}
				label={t("space.hosting.label")}
				onCheckedChange={(checked) => setQuestion(checked ? "start" : "stop")}
				status={hosting === "off" ? undefined : status[hosting]}
			/>
			<ConfirmDialog
				confirmLabel={t("space.hosting.start.confirm", { name })}
				confirmVariant="default"
				description={t("space.hosting.start.description")}
				onConfirm={answer(onHost)}
				onOpenChange={close}
				open={question === "start"}
				title={t("space.hosting.start.title", { name })}
			/>
			<ConfirmDialog
				confirmLabel={t("space.hosting.stop.confirm")}
				description={t("space.hosting.stop.description")}
				onConfirm={answer(onStopHosting)}
				onOpenChange={close}
				open={question === "stop"}
				title={t("space.hosting.stop.title", { name })}
			/>
		</>
	)
}

export { HostingPanel, type HostingPanelProps, type SpaceHosting }
