import type { ComponentProps, ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

interface AppHeaderProps extends Omit<ComponentProps<"header">, "children"> {
	leading?: ReactNode
	trailing?: ReactNode
	insetWindowControls?: boolean
	windowControls?: ReactNode
}

function AppHeader({
	leading,
	trailing,
	insetWindowControls = false,
	windowControls,
	className,
	...props
}: AppHeaderProps) {
	return (
		<header
			data-slot="app-header"
			className={cn(
				"flex h-12 shrink-0 items-center gap-3 border-border border-b pt-px",
				windowControls ? "pr-0" : "pr-2.5",
				insetWindowControls ? "pl-22" : "pl-1.5",
				className,
			)}
			{...props}
		>
			{leading ? (
				<div className="flex min-w-0 items-center gap-2 font-medium text-sm">
					{leading}
				</div>
			) : null}
			{trailing ? (
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{trailing}
				</div>
			) : null}
			{windowControls ? (
				<div
					className={cn(
						"-mt-px flex shrink-0 self-stretch",
						trailing ? null : "ml-auto",
					)}
					data-slot="app-header-window-controls"
				>
					{windowControls}
				</div>
			) : null}
		</header>
	)
}

export { AppHeader }
