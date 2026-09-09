import type { CSSProperties, ReactNode } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/bot-avatar"
import { ContentCard } from "@workspace/ui/components/content-card"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const SHELL = "surface-shell h-svh min-w-0 overflow-hidden"

type ShellStyle = CSSProperties & {
	"--sidebar-width-icon": string
	"--space-tint"?: string
}

const shellStyle = (tint?: BotAvatarBlot | null): ShellStyle => ({
	"--sidebar-width-icon": "var(--sidebar-rail)",
	...(tint ? { "--space-tint": blotTint(tint) } : undefined),
})

interface WorkspaceShellProps {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
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
	children,
	className,
}: WorkspaceShellProps) => (
	<SidebarProvider
		className={className ? `${SHELL} ${className}` : SHELL}
		data-space-tint={spaceTint ?? undefined}
		defaultOpen={defaultOpen}
		onOpenChange={onOpenChange}
		open={open}
		style={shellStyle(spaceTint)}
	>
		{sidebar}
		<ContentCard>{children}</ContentCard>
	</SidebarProvider>
)

export { WorkspaceShell, type WorkspaceShellProps }
