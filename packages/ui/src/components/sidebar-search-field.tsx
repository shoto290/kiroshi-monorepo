"use client"

import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Icons } from "@workspace/ui/components/icons"
import { Kbd } from "@workspace/ui/components/kbd"
import { FIELD_CONTROL_CLASS } from "@workspace/ui/components/settings-styles"
import { cn } from "@workspace/ui/lib/utils"

type SidebarSearchFieldProps = {
	chord?: string
	isCollapsed?: boolean
	onOpen: () => void
}

const FIELD_CLASS =
	"group/search-field flex h-9 cursor-pointer items-center gap-2 rounded-xl px-2 py-0 text-start hover:bg-muted"

const CHORD_CLASS = "group-hover/search-field:bg-background"

const SidebarSearchField = ({
	chord,
	isCollapsed = false,
	onOpen,
}: SidebarSearchFieldProps) => {
	const { t } = useTranslation("search")
	const label = t("open")

	if (isCollapsed)
		return (
			<div
				className="flex justify-center"
				data-collapsed="true"
				data-slot="sidebar-search-field"
			>
				<Button
					aria-label={label}
					onClick={onOpen}
					size="icon-sm"
					tooltip={label}
					tooltipSide="right"
					variant="ghost"
				>
					<Icons.Search aria-hidden="true" />
				</Button>
			</div>
		)

	return (
		<div data-collapsed="false" data-slot="sidebar-search-field">
			<button
				className={cn(FIELD_CONTROL_CLASS, FIELD_CLASS)}
				onClick={onOpen}
				type="button"
			>
				<Icons.Search
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
					{label}
				</span>
				<Kbd className={CHORD_CLASS}>{chord ?? t("chord")}</Kbd>
			</button>
		</div>
	)
}

export { SidebarSearchField, type SidebarSearchFieldProps }
