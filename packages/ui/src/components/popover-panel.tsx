"use client"

import {
	createContext,
	type ReactElement,
	type ReactNode,
	useContext,
	useMemo,
} from "react"

import { POPUP_CLASS } from "@workspace/ui/components/settings-styles"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { cn } from "@workspace/ui/lib/utils"

type PopoverPanelPlacement = "top-start" | "bottom-end"

const ANCHORS = {
	"top-start": { side: "top", align: "start" },
	"bottom-end": { side: "bottom", align: "end" },
} as const

type PopoverPanelContextValue = {
	placement: PopoverPanelPlacement
	sideOffset: number
}

const PopoverPanelContext = createContext<PopoverPanelContextValue | null>(null)

const usePopoverPanelContext = (component: string) => {
	const context = useContext(PopoverPanelContext)
	if (!context)
		throw new Error(`${component} must be used within <PopoverPanel>`)
	return context
}

type PopoverPanelProps = {
	children: ReactNode
	placement: PopoverPanelPlacement
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	sideOffset?: number
	className?: string
}

const PopoverPanel = ({
	children,
	placement,
	open,
	defaultOpen,
	onOpenChange,
	sideOffset = 14,
	className,
}: PopoverPanelProps) => {
	const context = useMemo<PopoverPanelContextValue>(
		() => ({ placement, sideOffset }),
		[placement, sideOffset],
	)

	return (
		<Popover
			defaultOpen={defaultOpen}
			modal={false}
			onOpenChange={(next) => onOpenChange?.(next)}
			open={open}
		>
			<PopoverPanelContext.Provider value={context}>
				<div className={cn("relative isolate inline-flex", className)}>
					{children}
				</div>
			</PopoverPanelContext.Provider>
		</Popover>
	)
}

type PopoverPanelTriggerProps = {
	children: ReactElement
}

const PopoverPanelTrigger = ({ children }: PopoverPanelTriggerProps) => {
	usePopoverPanelContext("PopoverPanelTrigger")

	return <PopoverTrigger render={children} />
}

type PopoverPanelContentProps = {
	children: ReactNode
	className?: string
	"aria-label"?: string
}

const PopoverPanelContent = ({
	children,
	className,
	"aria-label": ariaLabel,
}: PopoverPanelContentProps) => {
	const { placement, sideOffset } = usePopoverPanelContext(
		"PopoverPanelContent",
	)
	const { side, align } = ANCHORS[placement]

	return (
		<PopoverContent
			align={align}
			aria-label={ariaLabel}
			className={cn(
				POPUP_CLASS,
				"motion-reduce:duration-[0.01ms]! w-max max-w-[min(92vw,20rem)] gap-0 rounded-2xl p-4",
				className,
			)}
			side={side}
			sideOffset={sideOffset}
		>
			{children}
		</PopoverContent>
	)
}

export {
	PopoverPanel,
	PopoverPanelContent,
	type PopoverPanelPlacement,
	PopoverPanelTrigger,
}
