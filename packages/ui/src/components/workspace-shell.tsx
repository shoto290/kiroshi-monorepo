import { type CSSProperties, type ReactNode, useId } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/companion-colour"
import { ContentCard } from "@workspace/ui/components/content-card"
import { SidebarResizeProvider } from "@workspace/ui/components/sidebar-resize"
import { SkipLink } from "@workspace/ui/components/skip-link"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const SIDEBAR_INSIDE_SHELL =
	"**:data-[slot=sidebar-container]:absolute **:data-[slot=sidebar-container]:top-8.5 **:data-[slot=sidebar-container]:bottom-(--shell-inset) **:data-[slot=sidebar-container]:h-auto"

const TITLE_BAR_AND_GUTTER = "pt-8.5 pe-1 pb-1"

const CARD_ON_SHELL_INSET =
	"*:data-content-card:me-[calc(var(--shell-inset)-var(--spacing))] *:data-content-card:mb-[calc(var(--shell-inset)-var(--spacing))]"

const SHELL_TITLE_BAR_HEIGHT = 34

const SHELL_GUTTER = 4

const SHELL = `surface-shell relative h-svh ${TITLE_BAR_AND_GUTTER} ${CARD_ON_SHELL_INSET} min-h-full max-h-full min-w-0 overflow-hidden ${SIDEBAR_INSIDE_SHELL} data-[resizing=true]:cursor-col-resize data-[resizing=true]:select-none`

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
}: WorkspaceShellProps) => {
	const mainId = useId()
	const isMain = isLandmark ?? true

	return (
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
					{isMain ? <SkipLink targetId={mainId} /> : null}
					{sidebar}
					<ContentCard id={isMain ? mainId : undefined} isLandmark={isMain}>
						{children}
					</ContentCard>
				</SidebarProvider>
			)}
		</SidebarResizeProvider>
	)
}

export { SHELL_GUTTER, SHELL_TITLE_BAR_HEIGHT, WorkspaceShell }
