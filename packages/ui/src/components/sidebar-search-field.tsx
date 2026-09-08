"use client"

import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Icons } from "@workspace/ui/components/icons"
import { Kbd } from "@workspace/ui/components/kbd"

type SidebarSearchFieldProps = {
	chord?: string
	isCollapsed?: boolean
	onOpen: () => void
}

const FIELD_CLASS =
	"group/search-field flex min-h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-xl border border-border bg-transparent px-2 text-start text-sm font-medium text-sidebar-foreground/70 outline-none transition-colors duration-200 ease-out hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent/70 focus-visible:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none"

const CHORD_CLASS =
	"bg-sidebar-foreground/10 text-sidebar-foreground/70 group-hover/search-field:text-sidebar-accent-foreground group-focus-visible/search-field:text-sidebar-accent-foreground"

const GLYPH_CLASS =
	"size-4 shrink-0 text-sidebar-foreground/50 group-hover/search-field:text-sidebar-accent-foreground/70 group-focus-visible/search-field:text-sidebar-accent-foreground/70"

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
					className="hover:bg-sidebar-accent/70"
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
			<button className={FIELD_CLASS} onClick={onOpen} type="button">
				<Icons.Search aria-hidden="true" className={GLYPH_CLASS} />
				<span className="min-w-0 flex-1 truncate">{label}</span>
				<Kbd className={CHORD_CLASS}>{chord ?? t("chord")}</Kbd>
			</button>
		</div>
	)
}

export { SidebarSearchField, type SidebarSearchFieldProps }
