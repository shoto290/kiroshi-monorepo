import type { ReactNode } from "react"

import { AnimatedSidebarInset } from "@workspace/ui/components/motion/animated-sidebar"

const CARD = "m-1 rounded-xl border border-border"

const YIELDS_TO_NESTED_CARD = [
	"has-[[data-content-card]]:m-0",
	"has-[[data-content-card]]:rounded-none",
	"has-[[data-content-card]]:border-0",
	"has-[[data-content-card]]:bg-transparent",
].join(" ")

interface ContentCardProps {
	isLandmark?: boolean
	children?: ReactNode
}

const ContentCard = ({ isLandmark, children }: ContentCardProps) => (
	<AnimatedSidebarInset
		isLandmark={isLandmark}
		data-content-card=""
		className={`${CARD} ${YIELDS_TO_NESTED_CARD}`}
	>
		{children}
	</AnimatedSidebarInset>
)

export { ContentCard, type ContentCardProps }
