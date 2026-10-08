"use client"

import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/ui/button"

const SCREEN =
	"flex min-h-full w-full flex-1 flex-col items-center justify-center gap-4 bg-card px-6 py-12 text-center"

const TILE =
	"grid size-10 shrink-0 place-items-center rounded-control bg-foreground/10"

const TILE_DOT = "size-3 rounded-full bg-foreground/30"

const COPY = "flex max-w-100 flex-col gap-1.5"

const TITLE = "text-balance break-words font-medium text-base text-foreground"

const DESCRIPTION = "text-pretty break-words text-muted-foreground text-sm"

const BACK =
	"h-auto min-h-8 max-w-full whitespace-normal break-words px-3.5 py-1"

type SpaceRemovedScreenProps = {
	spaceName: string
	hostEmail: string
	backSpaceName: string
	onBack: () => void
}

const SpaceRemovedScreen = ({
	spaceName,
	hostEmail,
	backSpaceName,
	onBack,
}: SpaceRemovedScreenProps) => {
	const { t } = useTranslation("bots")
	const titleId = useId()

	return (
		<section
			aria-labelledby={titleId}
			className={SCREEN}
			data-slot="space-removed-screen"
		>
			<span aria-hidden="true" className={TILE}>
				<span className={TILE_DOT} />
			</span>
			<div className={COPY}>
				<h2 className={TITLE} id={titleId}>
					{t("spaces.removed.title", { name: spaceName })}
				</h2>
				<p className={DESCRIPTION}>
					{t("spaces.removed.description", { email: hostEmail })}
				</p>
			</div>
			<Button className={BACK} onClick={onBack} variant="outline">
				{t("spaces.removed.back", { name: backSpaceName })}
			</Button>
		</section>
	)
}

export { SpaceRemovedScreen, type SpaceRemovedScreenProps }
