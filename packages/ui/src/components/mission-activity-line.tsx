"use client"

import { useTranslation } from "react-i18next"

import type {
	MissionEventLink,
	MissionPullRequest,
} from "@workspace/ui/components/mission"
import { DOT_CLASS } from "@workspace/ui/components/row-anatomy"
import { cn } from "@workspace/ui/lib/utils"

const PART_CLASS = "shrink-0 whitespace-nowrap"

type MissionLinkProps = MissionEventLink & {
	className?: string
}

const hostOf = (url: string) => (URL.canParse(url) ? new URL(url).host : url)

const MissionLink = ({ url, pullRequest, className }: MissionLinkProps) => {
	const { t } = useTranslation("chat")
	const hasNumber = pullRequest !== undefined
	const host = hostOf(url)

	return (
		<a
			aria-label={
				hasNumber
					? t("missions.pullRequest.open", { number: pullRequest })
					: t("missions.event.link", { host })
			}
			className={cn(
				"relative shrink-0 whitespace-nowrap rounded-sm font-medium text-foreground tabular-nums outline-none after:absolute after:-inset-1 hover:underline focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
			data-slot="mission-link"
			href={url}
			rel="noreferrer noopener"
			target="_blank"
		>
			{hasNumber
				? t("missions.pullRequest.label", { number: pullRequest })
				: host}
		</a>
	)
}

type MissionActivityLineProps = {
	commitsAhead?: number
	pullRequest?: MissionPullRequest
	className?: string
}

const hasActivityLine = ({
	commitsAhead,
	pullRequest,
}: Pick<MissionActivityLineProps, "commitsAhead" | "pullRequest">) =>
	(commitsAhead ?? 0) > 0 || pullRequest !== undefined

const MissionActivityLine = ({
	commitsAhead = 0,
	pullRequest,
	className,
}: MissionActivityLineProps) => {
	const { t } = useTranslation("chat")
	const hasCommits = commitsAhead > 0

	return (
		<span
			className={cn(
				"flex h-4 min-w-0 items-center text-muted-foreground text-xs leading-4",
				className,
			)}
			data-slot="mission-activity"
		>
			{hasCommits ? (
				<span
					className={cn(PART_CLASS, "tabular-nums")}
					data-slot="mission-commits-ahead"
				>
					{t("missions.activity.commitsAhead", { count: commitsAhead })}
				</span>
			) : null}
			{pullRequest ? (
				<span className={cn(PART_CLASS, hasCommits && DOT_CLASS)}>
					<MissionLink pullRequest={pullRequest.number} url={pullRequest.url} />
				</span>
			) : null}
		</span>
	)
}

export {
	hasActivityLine,
	MissionActivityLine,
	type MissionActivityLineProps,
	MissionLink,
}
