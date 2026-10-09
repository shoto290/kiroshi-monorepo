"use client"

import { useTranslation } from "react-i18next"

import { HOVER_INTENT_DELAY_MS } from "@workspace/ui/components/tooltip-hint"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const PILL =
	"inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-title-bar-pill ps-2 pe-2.5 font-medium text-foreground text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

const PILL_OFFLINE = "text-muted-foreground"

const DOT = "pointer-events-none size-1.75 shrink-0 rounded-full"

const DOT_ONLINE = "bg-presence-online"

const DOT_OFFLINE = "bg-presence-offline"

const LABEL = "min-w-0 truncate"

const DETAILS =
	"flex-col items-start gap-0.5 rounded-md bg-muted px-2.5 py-2 text-foreground shadow-popover [&>[aria-hidden=true]]:hidden"

const DETAIL_EMAIL = "break-words font-medium leading-4"

const DETAIL_STATE = "break-words text-muted-foreground leading-4"

type HostPillProps = {
	hostName: string
	hostEmail: string
	spaceName: string
	isOnline: boolean
}

const HostPill = ({
	hostName,
	hostEmail,
	spaceName,
	isOnline,
}: HostPillProps) => {
	const { t } = useTranslation("bots")
	const label = t(isOnline ? "spaces.host.online" : "spaces.host.offline", {
		name: hostName,
	})

	return (
		<Tooltip>
			<TooltipTrigger
				delay={HOVER_INTENT_DELAY_MS}
				render={
					<button
						aria-label={
							isOnline
								? t("spaces.host.onlineLabel", { name: hostName })
								: label
						}
						className={cn(PILL, !isOnline && PILL_OFFLINE)}
						data-presence={isOnline ? "online" : "offline"}
						data-slot="host-pill"
						type="button"
					>
						<span
							aria-hidden="true"
							className={cn(DOT, isOnline ? DOT_ONLINE : DOT_OFFLINE)}
							data-slot="host-pill-dot"
						/>
						<span className={LABEL}>{label}</span>
					</button>
				}
			/>
			<TooltipContent
				className={cn(DETAILS, STILL_UNDER_REDUCED_MOTION)}
				data-slot="host-pill-details"
				role="tooltip"
				side="bottom"
			>
				<span className={DETAIL_EMAIL}>{hostEmail}</span>
				<span className={DETAIL_STATE}>
					{t(
						isOnline ? "spaces.host.onlineDetail" : "spaces.host.offlineDetail",
						{ space: spaceName },
					)}
				</span>
			</TooltipContent>
		</Tooltip>
	)
}

export { HostPill, type HostPillProps }
