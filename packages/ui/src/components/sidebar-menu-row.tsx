"use client"

import type { AriaAttributes, HTMLAttributes, ReactNode, Ref } from "react"

import {
	SidebarMenuButton,
	useSidebar,
} from "@workspace/ui/components/ui/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const ROW =
	"h-auto min-h-9 items-center gap-2.5 px-3 font-medium text-sidebar-foreground/70"

const ROW_ON_RAIL =
	"group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"

const ROW_WITH_ICON = "ps-2"

const ROW_STACKED = "flex-col items-stretch gap-1 pe-1.5"

const HEAD = "flex min-h-9 min-w-0 items-center gap-2.5 pe-1.5"

const ICON_SLOT = "grid min-h-5 min-w-5 shrink-0 place-items-center"

const LABEL_SLOT = "min-w-0 flex-1 truncate"

const LABEL_ON_RAIL =
	"group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:pointer-events-none"

type SidebarMenuRowElementProps = AriaAttributes &
	Pick<
		HTMLAttributes<HTMLElement>,
		"onPointerCancel" | "onPointerDown" | "onPointerMove" | "onPointerUp"
	>

interface SidebarMenuRowProps extends SidebarMenuRowElementProps {
	ref?: Ref<HTMLButtonElement>
	children: ReactNode
	below?: ReactNode
	icon?: ReactNode
	isIconDecorative?: boolean
	label?: string
	isActive?: boolean
	onSelect?: () => void
	className?: string
}

const SidebarMenuRow = ({
	children,
	below,
	icon,
	isIconDecorative = true,
	label,
	isActive = false,
	onSelect,
	className,
	ref,
	...elementProps
}: SidebarMenuRowProps) => {
	const { isMobile, setOpenMobile, state } = useSidebar()
	const isCollapsed = !isMobile && state === "collapsed"
	const textLabel =
		label ?? (typeof children === "string" ? children : undefined)

	const head = (
		<>
			{icon ? (
				<span aria-hidden={isIconDecorative || undefined} className={ICON_SLOT}>
					{icon}
				</span>
			) : null}
			<span aria-hidden={isCollapsed} className={cn(LABEL_SLOT, LABEL_ON_RAIL)}>
				{children}
			</span>
		</>
	)

	return (
		<SidebarMenuButton
			{...elementProps}
			aria-current={isActive ? "page" : undefined}
			aria-label={isCollapsed ? textLabel : undefined}
			className={cn(
				ROW,
				ROW_ON_RAIL,
				icon && ROW_WITH_ICON,
				below && ROW_STACKED,
				className,
			)}
			isActive={isActive}
			onClick={() => {
				onSelect?.()
				if (isMobile) setOpenMobile(false)
			}}
			ref={ref}
			title={isCollapsed ? textLabel : undefined}
		>
			{below ? (
				<>
					<span className={HEAD} data-slot="sidebar-menu-head">
						{head}
					</span>
					{below}
				</>
			) : (
				head
			)}
		</SidebarMenuButton>
	)
}

export { SidebarMenuRow, type SidebarMenuRowProps }
