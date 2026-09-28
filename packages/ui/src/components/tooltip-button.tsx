"use client"

import type { ReactNode } from "react"

import {
	TooltipHint,
	type TooltipHintSide,
} from "@workspace/ui/components/tooltip-hint"
import { Button } from "@workspace/ui/components/ui/button"

type TooltipButtonProps = React.ComponentProps<typeof Button> & {
	tooltip: ReactNode
	tooltipSide?: TooltipHintSide
}

const TooltipButton = ({
	tooltip,
	tooltipSide,
	...props
}: TooltipButtonProps) => (
	<TooltipHint content={tooltip} side={tooltipSide}>
		<Button {...props} />
	</TooltipHint>
)

export { TooltipButton }
