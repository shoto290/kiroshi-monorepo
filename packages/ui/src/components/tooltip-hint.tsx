"use client"

import type { ReactElement, ReactNode } from "react"

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"

const HOVER_INTENT_DELAY_MS = 120

type TooltipHintSide = "top" | "right" | "bottom" | "left"

type TooltipHintProps = {
	content: ReactNode
	children: ReactElement
	side?: TooltipHintSide
}

const TooltipHint = ({ content, children, side = "top" }: TooltipHintProps) => (
	<Tooltip>
		<TooltipTrigger delay={HOVER_INTENT_DELAY_MS} render={children} />
		<TooltipContent className="break-words" role="tooltip" side={side}>
			{content}
		</TooltipContent>
	</Tooltip>
)

export { TooltipHint, type TooltipHintSide }
