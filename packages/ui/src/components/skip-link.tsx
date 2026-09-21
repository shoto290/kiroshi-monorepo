import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"

const SKIP_LINK_CLASS =
	"sr-only font-medium text-foreground text-sm outline-none focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

interface SkipLinkProps {
	targetId: string
}

const SkipLink = ({ targetId }: SkipLinkProps) => {
	const { t } = useTranslation("common")

	const skip = (event: MouseEvent<HTMLAnchorElement>) => {
		const target = document.getElementById(targetId)
		if (!target) return
		event.preventDefault()
		target.focus()
	}

	return (
		<a
			className={SKIP_LINK_CLASS}
			data-slot="skip-link"
			href={`#${targetId}`}
			onClick={skip}
		>
			{t("skipLink")}
		</a>
	)
}

export { SkipLink, type SkipLinkProps }
