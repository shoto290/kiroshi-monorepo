"use client"

import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"

const SHARE =
	"h-6 gap-1.5 rounded-md border-input bg-shell-divider px-2 text-compact text-foreground leading-4 hover:bg-rail-item-selected dark:hover:bg-rail-item-selected"

const SHARE_ICON = "size-3.5"

type ShareButtonProps = {
	onShare: () => void
}

const ShareButton = ({ onShare }: ShareButtonProps) => {
	const { t } = useTranslation("bots")

	return (
		<Button
			className={SHARE}
			data-slot="share-button"
			onClick={onShare}
			variant="ghost"
		>
			<Icons.Users aria-hidden="true" className={SHARE_ICON} />
			{t("spaces.share")}
		</Button>
	)
}

export { ShareButton, type ShareButtonProps }
