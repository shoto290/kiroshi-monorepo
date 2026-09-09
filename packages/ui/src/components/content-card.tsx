import type { ReactNode } from "react"

import { SidebarInset } from "@workspace/ui/components/ui/sidebar"

const YIELDS_TO_NESTED_CARD = [
	"has-[[data-content-card]]:my-0",
	"has-[[data-content-card]]:me-0",
	"has-[[data-content-card]]:rounded-none",
	"has-[[data-content-card]]:bg-transparent",
].join(" ")

const YIELDS_TO_TRAILING_PANEL = "not-last:me-0"

const SURFACE = `relative my-2 me-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background ${YIELDS_TO_TRAILING_PANEL} ${YIELDS_TO_NESTED_CARD}`

interface ContentCardProps {
	isLandmark?: boolean
	children?: ReactNode
}

const ContentCard = ({ isLandmark = true, children }: ContentCardProps) =>
	isLandmark ? (
		<SidebarInset className={SURFACE} data-content-card="">
			{children}
		</SidebarInset>
	) : (
		<div className={SURFACE} data-content-card="" data-slot="sidebar-inset">
			{children}
		</div>
	)

export { ContentCard, type ContentCardProps }
