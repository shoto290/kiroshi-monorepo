"use client"

import { useTranslation } from "react-i18next"

import {
	isMissionSilent,
	type MissionActivity,
	type MissionEventLink,
	type MissionPullRequest,
	type MissionState,
} from "@workspace/ui/components/mission"
import { DOT_CLASS } from "@workspace/ui/components/row-anatomy"
import { TooltipHint } from "@workspace/ui/components/tooltip-hint"
import { readableTool } from "@workspace/ui/lib/agent-tool"
import { toCompactAge } from "@workspace/ui/lib/time-format"
import { cn } from "@workspace/ui/lib/utils"

type MissionLinkProps = MissionEventLink & {
	className?: string
}

const MissionLink = ({ url, pullRequest, className }: MissionLinkProps) => {
	const { t } = useTranslation("chat")
	const hasNumber = pullRequest !== undefined

	return (
		<a
			aria-label={
				hasNumber
					? t("missions.pullRequest.open", { number: pullRequest })
					: undefined
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
				: t("missions.event.link")}
		</a>
	)
}

type MissionActivityLineProps = {
	state: MissionState
	now: number
	lastActivity?: MissionActivity
	lastActivityAt?: number
	commitsAhead?: number
	pullRequest?: MissionPullRequest
	className?: string
}

const PART_CLASS = "shrink-0 whitespace-nowrap"

const hasActivityLine = ({
	lastActivity,
	commitsAhead,
	pullRequest,
}: Pick<
	MissionActivityLineProps,
	"lastActivity" | "commitsAhead" | "pullRequest"
>) =>
	lastActivity !== undefined ||
	(commitsAhead ?? 0) > 0 ||
	pullRequest !== undefined

const MissionActivityLine = ({
	state,
	now,
	lastActivity,
	lastActivityAt,
	commitsAhead = 0,
	pullRequest,
	className,
}: MissionActivityLineProps) => {
	const { t } = useTranslation("chat")
	const at = lastActivity ? lastActivityAt : undefined
	const isSilent = isMissionSilent({ state, at, now })
	const hasCommits = commitsAhead > 0

	return (
		<span
			className={cn(
				"flex h-4 min-w-0 items-center text-muted-foreground text-xs leading-4",
				className,
			)}
			data-slot="mission-activity"
		>
			{lastActivity ? (
				<>
					<span className="min-w-0 truncate" data-slot="mission-activity-tool">
						{readableTool(t, lastActivity.tool)}
					</span>
					<span className={cn("flex min-w-0 shrink-[100]", DOT_CLASS)}>
						<TooltipHint content={lastActivity.target}>
							<span
								className="min-w-0 truncate"
								data-slot="mission-activity-target"
								dir="rtl"
							>
								<bdi>{lastActivity.target}</bdi>
							</span>
						</TooltipHint>
					</span>
				</>
			) : null}
			{at === undefined ? null : (
				<time
					className={cn(PART_CLASS, "tabular-nums", DOT_CLASS)}
					data-slot={isSilent ? "mission-silence" : "mission-activity-age"}
					dateTime={new Date(at).toISOString()}
				>
					{isSilent
						? t("missions.activity.silent", { age: toCompactAge(at, now) })
						: toCompactAge(at, now)}
				</time>
			)}
			{hasCommits ? (
				<span
					className={cn(PART_CLASS, "tabular-nums", lastActivity && DOT_CLASS)}
					data-slot="mission-commits-ahead"
				>
					{t("missions.activity.commitsAhead", { count: commitsAhead })}
				</span>
			) : null}
			{pullRequest ? (
				<span
					className={cn(PART_CLASS, (lastActivity || hasCommits) && DOT_CLASS)}
				>
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
