import type { CSSProperties, ReactNode } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { ContentCard } from "@workspace/ui/components/content-card"
import { SidebarResizeProvider } from "@workspace/ui/components/sidebar-resize"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const SHELL =
	"surface-shell h-svh min-w-0 overflow-hidden data-[resizing=true]:cursor-col-resize data-[resizing=true]:select-none"

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
	children: ReactNode
}

const WorkspaceShell = ({
	sidebar,
	spaceTint,
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
				<ContentCard>{children}</ContentCard>
			</SidebarProvider>
		)}
	</SidebarResizeProvider>
)

export { WorkspaceShell, type WorkspaceShellProps }
