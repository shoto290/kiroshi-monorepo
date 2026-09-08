"use client"

import { type ReactNode, useContext } from "react"

import { MessageSideContext } from "@workspace/ui/components/message-side-context"
import { TooltipButton } from "@workspace/ui/components/tooltip-button"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from "@workspace/ui/components/ui/context-menu"
import { cn } from "@workspace/ui/lib/utils"

interface MessageActionsProps {
	actions?: ReactNode
	menu?: ReactNode
	children: ReactNode
}

interface MessageActionProps {
	label: string
	onClick: () => void
	alwaysVisible?: boolean
	children: ReactNode
}

const STILL_UNDER_REDUCED_MOTION = "motion-reduce:animate-none!"

const HOVER_REVEAL =
	"opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100"

const ROW_SIDE_START = "flex max-w-full items-start gap-1"
const ROW_SIDE_END = `${ROW_SIDE_START} flex-row-reverse`

function MessageActions({ actions, menu, children }: MessageActionsProps) {
	const side = useContext(MessageSideContext) ?? "start"

	const row = (
		<div
			data-slot="message-actions"
			className={side === "end" ? ROW_SIDE_END : ROW_SIDE_START}
		>
			{children}
			<div
				className={cn(
					"mt-2.5 flex items-center gap-0.5 empty:hidden",
					side === "end" && "flex-row-reverse",
				)}
			>
				{actions}
			</div>
		</div>
	)

	if (!menu) return row

	return (
		<ContextMenu>
			<ContextMenuTrigger render={row} />
			<ContextMenuContent className={STILL_UNDER_REDUCED_MOTION}>
				{menu}
			</ContextMenuContent>
		</ContextMenu>
	)
}

function MessageAction({
	label,
	onClick,
	alwaysVisible = false,
	children,
}: MessageActionProps) {
	return (
		<TooltipButton
			size="icon-xs"
			variant="ghost"
			aria-label={label}
			tooltip={label}
			onClick={onClick}
			className={alwaysVisible ? undefined : HOVER_REVEAL}
		>
			{children}
		</TooltipButton>
	)
}

export {
	MessageAction,
	type MessageActionProps,
	MessageActions,
	type MessageActionsProps,
}
