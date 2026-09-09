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

type PopoverPanelSide = "top" | "bottom"
type PopoverPanelAlign = "start" | "center" | "end"
type PopoverPanelTriggerMode = "click" | "hover"

const HOVER_CLOSE_DELAY = 120

type PopoverPanelContextValue = {
	triggerMode: PopoverPanelTriggerMode
	side: PopoverPanelSide
	align: PopoverPanelAlign
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
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	trigger?: PopoverPanelTriggerMode
	side?: PopoverPanelSide
	align?: PopoverPanelAlign
	sideOffset?: number
	className?: string
}

const PopoverPanel = ({
	children,
	open,
	defaultOpen,
	onOpenChange,
	trigger = "click",
	side = "bottom",
	align = "center",
	sideOffset = 14,
	className,
}: PopoverPanelProps) => {
	const context = useMemo<PopoverPanelContextValue>(
		() => ({ triggerMode: trigger, side, align, sideOffset }),
		[trigger, side, align, sideOffset],
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
	const { triggerMode } = usePopoverPanelContext("PopoverPanelTrigger")
	const onHover = triggerMode === "hover"

	return (
		<PopoverTrigger
			closeDelay={onHover ? HOVER_CLOSE_DELAY : undefined}
			openOnHover={onHover}
			render={children}
		/>
	)
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
	const { side, align, sideOffset } = usePopoverPanelContext(
		"PopoverPanelContent",
	)

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
	type PopoverPanelAlign,
	PopoverPanelContent,
	type PopoverPanelSide,
	PopoverPanelTrigger,
	type PopoverPanelTriggerMode,
}
