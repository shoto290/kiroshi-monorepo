import { cva } from "class-variance-authority"
import { useTranslation } from "react-i18next"

import { BOT_TITLE_BADGE_SHAPE } from "@workspace/ui/components/badge"
import { type Icon, Icons } from "@workspace/ui/components/icons"
import type { MissionState } from "@workspace/ui/components/mission"
import { cn } from "@workspace/ui/lib/utils"

const MISSION_STATE_MARK: Record<MissionState, Icon> = {
	working: Icons.Loading,
	waiting_bot: Icons.Pending,
	waiting_human: Icons.Bell,
	ready_to_merge: Icons.Check,
	failed: Icons.Error,
	done: Icons.Success,
}

const MISSION_STATE_MARK_CLASS: Record<MissionState, string> = {
	working: "animate-spin text-muted-foreground motion-reduce:animate-none",
	waiting_bot: "text-muted-foreground",
	waiting_human: "text-bot-badge-attention",
	ready_to_merge: "text-bot-badge-done",
	failed: "text-destructive",
	done: "text-muted-foreground",
}

type MissionStatePillSize = "default" | "titleBadge"

type MissionStateTone = "neutral" | "outline" | "danger"

const missionStatePillVariants = cva(
	"inline-flex w-fit max-w-full shrink-0 items-center gap-1 whitespace-nowrap font-medium",
	{
		variants: {
			tone: {
				neutral: "bg-secondary text-secondary-foreground",
				outline: "border border-border text-foreground",
				danger: "bg-destructive/10 text-foreground dark:bg-destructive/20",
			},
			size: {
				default: "h-5 rounded-2xl py-0.5 pr-2 pl-1.5 text-xs [&>svg]:size-3",
				titleBadge: cn(BOT_TITLE_BADGE_SHAPE, "[&>svg]:size-2.5"),
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

const MISSION_STATE_TONE: Record<MissionState, MissionStateTone> = {
	working: "neutral",
	waiting_bot: "neutral",
	waiting_human: "outline",
	ready_to_merge: "outline",
	failed: "danger",
	done: "neutral",
}

type MissionStatePillProps = {
	state: MissionState
	size?: MissionStatePillSize
	className?: string
}

const MissionStatePill = ({
	state,
	size = "default",
	className,
}: MissionStatePillProps) => {
	const { t } = useTranslation("chat")
	const Mark = MISSION_STATE_MARK[state]

	return (
		<span
			className={cn(
				missionStatePillVariants({ size, tone: MISSION_STATE_TONE[state] }),
				className,
			)}
			data-slot="mission-state-pill"
			data-state={state}
		>
			<Mark
				aria-hidden="true"
				className={cn("shrink-0", MISSION_STATE_MARK_CLASS[state])}
			/>
			<span className="truncate">{t(`missions.state.${state}`)}</span>
		</span>
	)
}

export {
	MissionStatePill,
	type MissionStatePillProps,
	type MissionStatePillSize,
}
