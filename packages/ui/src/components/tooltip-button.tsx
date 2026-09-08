"use client"

import {
	Tooltip,
	type TooltipProps,
} from "@workspace/ui/components/motion/tooltip"
import { Button } from "@workspace/ui/components/ui/button"

type TooltipButtonProps = React.ComponentProps<typeof Button> & {
	tooltip: string
	tooltipSide?: TooltipProps["side"]
}

const TooltipButton = ({
	tooltip,
	tooltipSide,
	...props
}: TooltipButtonProps) => (
	<Tooltip content={tooltip} side={tooltipSide}>
		<Button {...props} />
	</Tooltip>
)

export { TooltipButton }
