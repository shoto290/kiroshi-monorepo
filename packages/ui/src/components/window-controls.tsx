"use client"

import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"

type WindowControlsProps = {
	maximized: boolean
	onMinimize: () => void
	onToggleMaximize: () => void
	onClose: () => void
}

const ROW = "ms-auto flex h-full justify-end"

const CAPTION_BUTTON =
	"h-full w-11.5 rounded-none active:scale-100! [&_svg:not([class*='size-'])]:size-2.5"

const CLOSE_BUTTON =
	"hover:bg-window-close hover:text-white dark:hover:bg-window-close"

const WindowControls = ({
	maximized,
	onMinimize,
	onToggleMaximize,
	onClose,
}: WindowControlsProps) => {
	const { t } = useTranslation("common")
	const MaximizeGlyph = maximized ? Icons.Restore : Icons.Maximize

	return (
		<div className={ROW} data-slot="window-controls">
			<Button
				aria-label={t("windowControls.minimize")}
				className={CAPTION_BUTTON}
				onClick={onMinimize}
				variant="ghost"
			>
				<Icons.Minimize aria-hidden="true" />
			</Button>
			<Button
				aria-label={t(
					maximized ? "windowControls.restore" : "windowControls.maximize",
				)}
				className={CAPTION_BUTTON}
				onClick={onToggleMaximize}
				variant="ghost"
			>
				<MaximizeGlyph aria-hidden="true" />
			</Button>
			<Button
				aria-label={t("windowControls.close")}
				className={cn(CAPTION_BUTTON, CLOSE_BUTTON)}
				onClick={onClose}
				variant="ghost"
			>
				<Icons.Close aria-hidden="true" />
			</Button>
		</div>
	)
}

export { WindowControls }
