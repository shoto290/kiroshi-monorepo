"use client"

import { useTranslation } from "react-i18next"

import { cn } from "@workspace/ui/lib/utils"

const PILL =
	"inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-title-bar-pill ps-2 pe-2.5 font-medium text-foreground text-xs"

const PILL_OFFLINE = "text-muted-foreground"

const DOT = "pointer-events-none size-1.75 shrink-0 rounded-full"

const DOT_ONLINE = "bg-presence-online"

const DOT_OFFLINE = "bg-presence-offline"

const LABEL = "min-w-0 truncate"

type HostPillProps = {
	isOnline: boolean
}

const HostPill = ({ isOnline }: HostPillProps) => {
	const { t } = useTranslation("bots")

	return (
		<span className={cn(PILL, !isOnline && PILL_OFFLINE)} data-slot="host-pill">
			<span
				aria-hidden="true"
				className={cn(DOT, isOnline ? DOT_ONLINE : DOT_OFFLINE)}
				data-slot="host-pill-dot"
			/>
			<span className={LABEL}>
				{t(isOnline ? "spaces.host.online" : "spaces.host.offline")}
			</span>
		</span>
	)
}

export { HostPill, type HostPillProps }
