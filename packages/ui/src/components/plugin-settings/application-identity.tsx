"use client"

import { Fragment, type ReactNode } from "react"
import { Trans, useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"

const META_SEPARATOR = "·"

const ApplicationVerifiedPill = () => {
	const { t } = useTranslation("bots")

	return (
		<span
			className="flex shrink-0 items-center gap-0.75 rounded-full bg-muted py-px ps-1.5 pe-1.75 font-medium text-muted-foreground text-xs/4 group-hover:bg-background"
			data-slot="application-verified"
		>
			<Icons.Check
				aria-hidden="true"
				className="size-3 shrink-0"
				strokeWidth={3}
			/>
			{t("applications.verified")}
		</span>
	)
}

type ApplicationMetaPart = {
	id: string
	node: ReactNode
}

type ApplicationMetaLineProps = {
	source?: string
	useCount?: number
	host?: string
	packageIdentity?: string
}

const ApplicationMetaLine = ({
	source,
	useCount,
	host,
	packageIdentity,
}: ApplicationMetaLineProps) => {
	const { t } = useTranslation("bots")

	const trailing = () => {
		if (host !== undefined) {
			return (
				<Trans
					components={{ host: <span className="font-mono" /> }}
					i18nKey="applications.hostedOn"
					t={t}
					values={{ host }}
				/>
			)
		}

		if (packageIdentity !== undefined) {
			return <span className="font-mono">{packageIdentity}</span>
		}

		return null
	}

	const parts: ApplicationMetaPart[] = []

	if (source !== undefined) {
		parts.push({
			id: "source",
			node: <span className="truncate">{source}</span>,
		})
	}

	if (useCount !== undefined) {
		parts.push({
			id: "uses",
			node: (
				<span className="shrink-0 tabular-nums">
					{t("applications.uses", { count: useCount })}
				</span>
			),
		})
	}

	const trailingNode = trailing()

	if (trailingNode !== null) {
		parts.push({
			id: "trailing",
			node: <span className="truncate">{trailingNode}</span>,
		})
	}

	if (parts.length === 0) return null

	return (
		<span
			className="flex h-4 min-w-0 items-center gap-1.25 text-muted-foreground text-xs/4"
			data-slot="application-meta"
		>
			{parts.map((part, index) => (
				<Fragment key={part.id}>
					{index === 0 ? null : (
						<span aria-hidden="true" className="shrink-0">
							{META_SEPARATOR}
						</span>
					)}
					{part.node}
				</Fragment>
			))}
		</span>
	)
}

export {
	ApplicationMetaLine,
	type ApplicationMetaLineProps,
	ApplicationVerifiedPill,
}
