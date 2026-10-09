"use client"

import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	type SettingsSwitchStatus,
	StatusLine,
} from "@workspace/ui/components/settings-switch"
import { ToggleSwitch } from "@workspace/ui/components/toggle-switch"
import { Button } from "@workspace/ui/components/ui/button"

type SpaceHosting = "off" | "connecting" | "online" | "signed-out"

type ShareCardProps = {
	name: string
	hosting: SpaceHosting
	onHost: () => void
	onStopHosting: () => void
	onSignIn: () => void
}

const ShareCard = ({
	name,
	hosting,
	onHost,
	onStopHosting,
	onSignIn,
}: ShareCardProps) => {
	const { t } = useTranslation("settings")
	const id = useId()
	const titleId = `${id}-title`
	const descriptionId = `${id}-description`
	const isSignedOut = hosting === "signed-out"

	const statusOf: Partial<Record<SpaceHosting, SettingsSwitchStatus>> = {
		connecting: { tone: "pending", label: t("space.hosting.connecting") },
		online: { tone: "done", label: t("space.hosting.online") },
	}

	return (
		<div
			className="flex shrink-0 items-start justify-between gap-4 rounded-control border border-border p-3.5"
			data-slot="share-card"
		>
			<div className="flex min-w-0 flex-col">
				<div className="flex flex-col gap-1">
					<p
						className="break-words font-medium text-foreground text-sm/5"
						id={titleId}
					>
						{t("space.hosting.label", { name })}
					</p>
					<p
						className="break-words text-muted-foreground text-xs/4.5"
						id={descriptionId}
					>
						{isSignedOut
							? t("space.hosting.signedOut")
							: t("space.hosting.description", { name })}
					</p>
				</div>
				<StatusLine status={statusOf[hosting]} />
			</div>
			{isSignedOut ? (
				<Button aria-describedby={descriptionId} onClick={onSignIn}>
					{t("space.hosting.signIn")}
					<Icons.ExternalLink data-icon="inline-end" />
				</Button>
			) : (
				<ToggleSwitch
					aria-describedby={descriptionId}
					aria-labelledby={titleId}
					checked={hosting !== "off"}
					onCheckedChange={(checked) => (checked ? onHost : onStopHosting)()}
				/>
			)}
		</div>
	)
}

export { ShareCard, type ShareCardProps, type SpaceHosting }
