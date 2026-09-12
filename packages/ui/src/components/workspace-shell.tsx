import type { CSSProperties, ReactNode } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { ContentCard } from "@workspace/ui/components/content-card"
import { SidebarResizeProvider } from "@workspace/ui/components/sidebar-resize"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const SIDEBAR_INSIDE_SHELL =
	"**:data-[slot=sidebar-container]:absolute **:data-[slot=sidebar-container]:h-auto"

const SHELL = `surface-shell relative h-svh min-h-full max-h-full min-w-0 overflow-hidden ${SIDEBAR_INSIDE_SHELL} data-[resizing=true]:cursor-col-resize data-[resizing=true]:select-none`

type ShellStyle = CSSProperties & {
	"--sidebar-width": string
	"--sidebar-width-icon": string
	"--space-tint"?: string
}

const shellStyle = (
	width: number,
	tint?: BotAvatarBlot | null,
): ShellStyle => ({
	"--sidebar-width": `${width}px`,
	"--sidebar-width-icon": "var(--sidebar-rail)",
	...(tint ? { "--space-tint": blotTint(tint) } : undefined),
})

interface WorkspaceShellProps {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	width?: number
	defaultWidth?: number
	onWidthChange?: (width: number) => void
	isResizable?: boolean
	className?: string
	sidebar?: ReactNode
	spaceTint?: BotAvatarBlot | null
	isLandmark?: boolean
	children: ReactNode
}

const WorkspaceShell = ({
	sidebar,
	spaceTint,
	isLandmark,
	open,
	defaultOpen,
	onOpenChange,
	width,
	defaultWidth,
	onWidthChange,
	isResizable,
	children,
	className,
}: WorkspaceShellProps) => (
	<SidebarResizeProvider
		defaultWidth={defaultWidth}
		isResizable={isResizable}
		onWidthChange={onWidthChange}
		width={width}
	>
		{(resize) => (
			<SidebarProvider
				className={cn(SHELL, className)}
				data-resizing={resize.isResizing}
				data-space-tint={spaceTint ?? undefined}
				defaultOpen={defaultOpen}
				onOpenChange={onOpenChange}
				open={open}
				style={shellStyle(resize.width, spaceTint)}
			>
				{sidebar}
				<ContentCard isLandmark={isLandmark}>{children}</ContentCard>
			</SidebarProvider>
		)}
	</SidebarResizeProvider>
)

export { WorkspaceShell, type WorkspaceShellProps }
