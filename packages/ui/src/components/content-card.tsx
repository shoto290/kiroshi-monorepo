import type { ReactNode } from "react"

import { SidebarInset } from "@workspace/ui/components/ui/sidebar"

const YIELDS_TO_NESTED_CARD = [
	"has-[[data-content-card]]:m-0",
	"has-[[data-content-card]]:rounded-none",
	"has-[[data-content-card]]:border-0",
	"has-[[data-content-card]]:bg-transparent",
].join(" ")

const SURFACE = `relative m-1 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background ${YIELDS_TO_NESTED_CARD}`

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
