import type { ReactNode } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { ContentCard } from "@workspace/ui/components/content-card"
import {
	AnimatedSidebarProvider,
	type AnimatedSidebarProviderProps,
} from "@workspace/ui/components/motion/animated-sidebar"

interface WorkspaceShellProps
	extends Pick<
		AnimatedSidebarProviderProps,
		| "open"
		| "defaultOpen"
		| "onOpenChange"
		| "width"
		| "defaultWidth"
		| "onWidthChange"
		| "isResizable"
		| "className"
	> {
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
	<AnimatedSidebarProvider
		data-slot="workspace-shell"
		open={open}
		defaultOpen={defaultOpen}
		onOpenChange={onOpenChange}
		width={width}
		defaultWidth={defaultWidth}
		onWidthChange={onWidthChange}
		isResizable={isResizable}
		data-space-tint={spaceTint ?? undefined}
		style={spaceTint ? { "--space-tint": blotTint(spaceTint) } : undefined}
		className={className}
	>
		{sidebar}
		<ContentCard>{children}</ContentCard>
	</AnimatedSidebarProvider>
)

export { WorkspaceShell, type WorkspaceShellProps }
