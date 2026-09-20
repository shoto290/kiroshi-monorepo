"use client"

import { type ReactNode, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
	PromptMenuRow,
	PromptMenuSurface,
	usePromptMenu,
} from "@workspace/ui/components/prompt-menu"

export interface PromptCommandOption {
	name: string
	description?: string
}

export interface PromptCommandMenuProps {
	commands: PromptCommandOption[]
	open: boolean
	query: string
	onSelect: (command: string) => void
	onDismiss: () => void
	children: ReactNode
	className?: string
}

export function PromptCommandMenu({
	commands,
	open,
	query,
	onSelect,
	onDismiss,
	children,
	className,
}: PromptCommandMenuProps) {
	const { t } = useTranslation("chat")

	const matches = useMemo(() => {
		const needle = query.toLocaleLowerCase()
		return commands.filter((command) =>
			command.name.toLocaleLowerCase().includes(needle),
		)
	}, [commands, query])

	const { rootRef, isOpen, active, activateOnPointerMove } = usePromptMenu({
		open,
		query,
		count: matches.length,
		onChoose: (index) => onSelect(matches[index].name),
		onDismiss,
	})

	return (
		<PromptMenuSurface
			className={className}
			isOpen={isOpen}
			label={t("composer.commands")}
			panelClassName="absolute bottom-full left-0 z-50 mb-2 min-w-64 max-w-[min(24rem,100%)] overflow-hidden rounded-xl p-1.5 shadow-popover"
			rootRef={rootRef}
			rows={matches.map((command, index) => (
				<PromptMenuRow
					key={command.name}
					className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-foreground text-sm outline-none"
					isActive={index === active}
					onPointerMove={activateOnPointerMove(index)}
					onSelect={() => onSelect(command.name)}
				>
					<span className="truncate">{command.name}</span>
					{command.description ? (
						<span className="truncate text-muted-foreground text-xs">
							{command.description}
						</span>
					) : null}
				</PromptMenuRow>
			))}
			slot="prompt-command-menu"
		>
			{children}
		</PromptMenuSurface>
	)
}
