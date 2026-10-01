"use client"

import { useId } from "react"
import { useTranslation } from "react-i18next"

import { CopyField } from "@workspace/ui/components/copy-field"
import { Icons } from "@workspace/ui/components/icons"

type ShareLinkProps = {
	link: string | null
	onCopy?: () => void
}

const ShareLink = ({ link, onCopy }: ShareLinkProps) => {
	const { t } = useTranslation("settings")
	const hintId = useId()
	const warningId = useId()

	return (
		<div className="flex flex-col gap-1.5" data-slot="share-link">
			<CopyField
				copiedLabel={t("space.share.copied")}
				copyLabel={t("space.share.copy")}
				describedBy={link ? `${hintId} ${warningId}` : hintId}
				label={t("space.share.label")}
				onCopy={onCopy}
				value={link ?? ""}
			/>
			<p className="text-muted-foreground text-xs" id={hintId}>
				{link ? t("space.share.hint") : t("space.share.hostDown")}
			</p>
			{link ? (
				<p
					className="flex items-start gap-1.5 text-foreground/80 text-xs"
					id={warningId}
				>
					<Icons.Key
						aria-hidden="true"
						className="mt-0.5 size-3 shrink-0 text-bot-badge-attention"
					/>
					{t("space.share.warning")}
				</p>
			) : null}
		</div>
	)
}

export { ShareLink, type ShareLinkProps }
