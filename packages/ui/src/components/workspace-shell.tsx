import { type CSSProperties, type ReactNode, useId } from "react"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/companion-colour"
import { ContentCard } from "@workspace/ui/components/content-card"
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

const SIDEBAR_WIDTH = 304

const SHELL = `surface-shell relative h-svh ${TITLE_BAR_AND_GUTTER} ${CARD_ON_SHELL_INSET} min-h-full max-h-full min-w-0 overflow-hidden ${SIDEBAR_INSIDE_SHELL}`

type ShellStyle = CSSProperties & {
	"--sidebar-width": string
	"--space-tint"?: string
}

const shellStyle = (tint?: BotAvatarBlot | null): ShellStyle => ({
	"--sidebar-width": `${SIDEBAR_WIDTH}px`,
	...(tint ? { "--space-tint": blotTint(tint) } : undefined),
})

interface WorkspaceShellProps {
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
	children,
	className,
}: WorkspaceShellProps) => {
	const mainId = useId()
	const isMain = isLandmark ?? true

	return (
		<SidebarProvider
			className={cn(SHELL, className)}
			data-space-tint={spaceTint ?? undefined}
			open
			style={shellStyle(spaceTint)}
		>
			{isMain ? <SkipLink targetId={mainId} /> : null}
			{sidebar}
			<ContentCard id={isMain ? mainId : undefined} isLandmark={isMain}>
				{children}
			</ContentCard>
		</SidebarProvider>
	)
}

export { SHELL_GUTTER, SHELL_TITLE_BAR_HEIGHT, SIDEBAR_WIDTH, WorkspaceShell }
