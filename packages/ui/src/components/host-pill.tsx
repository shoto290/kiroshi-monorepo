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
	"inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-title-bar-pill ps-2 pe-2.5 font-medium text-foreground text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

const PILL_OFFLINE = "text-muted-foreground"

const DOT = "pointer-events-none size-1.75 shrink-0 rounded-full"

const DOT_ONLINE = "bg-presence-online"

const DOT_OFFLINE = "bg-presence-offline"

const LABEL = "min-w-0 truncate"

const DETAILS =
	"flex-col items-start rounded-md bg-muted px-2.5 py-2 text-foreground shadow-popover [&>[aria-hidden=true]]:hidden"

type HostPillProps = {
	isOnline: boolean
}

const HostPill = ({ isOnline }: HostPillProps) => {
	const { t } = useTranslation("bots")

	return (
		<Tooltip>
			<TooltipTrigger
				delay={HOVER_INTENT_DELAY_MS}
				render={
					<button
						className={cn(PILL, !isOnline && PILL_OFFLINE)}
						data-slot="host-pill"
						type="button"
					>
						<span
							aria-hidden="true"
							className={cn(DOT, isOnline ? DOT_ONLINE : DOT_OFFLINE)}
							data-slot="host-pill-dot"
						/>
						<span className={LABEL}>
							{t(isOnline ? "spaces.host.online" : "spaces.host.offline")}
						</span>
					</button>
				}
			/>
			<TooltipContent
				className={cn(DETAILS, STILL_UNDER_REDUCED_MOTION)}
				data-slot="host-pill-details"
				role="tooltip"
				side="bottom"
			>
				{t(isOnline ? "spaces.host.onlineDetail" : "spaces.host.offlineDetail")}
			</TooltipContent>
		</Tooltip>
	)
}

export { HostPill, type HostPillProps }
