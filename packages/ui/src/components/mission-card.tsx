"use client"

import { useTranslation } from "react-i18next"

import {
	MESSAGE_BUBBLE_INTERACTIVE,
	MESSAGE_BUBBLE_PADDING_INSET,
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import {
	type MissionCardModel,
	type MissionStatusProps,
	shownMissionStatus,
} from "@workspace/ui/components/mission"
import {
	MissionStatusTime,
	MissionTicketLine,
	MissionToolMark,
} from "@workspace/ui/components/mission-marks"
import {
	hasStatePill,
	MissionStatePill,
} from "@workspace/ui/components/mission-state-pill"
import { TooltipHint } from "@workspace/ui/components/tooltip-hint"
import { cn } from "@workspace/ui/lib/utils"

type MissionCardProps = Omit<MissionCardModel, "author" | "identity"> &
	MissionStatusProps & {
		onOpen: (missionId: string) => void
		className?: string
	}

type MissionTitleRowProps = Pick<MissionCardModel, "state" | "tools">

const MissionTitleRow = ({ state, tools }: MissionTitleRowProps) => {
	if (tools.length === 0 && !hasStatePill(state)) return null

	return (
		<span
			className="flex flex-wrap items-center gap-x-2 gap-y-1"
			data-slot="mission-title-row"
		>
			{tools.map((tool) => (
				<MissionToolMark key={tool} tool={tool} />
			))}
			<MissionStatePill state={state} />
		</span>
	)
}

const MissionCard = ({
	id,
	objective,
	state,
	ticket,
	tools,
	isWorking,
	isClosed,
	status,
	now,
	onOpen,
	className,
}: MissionCardProps) => {
	const { t } = useTranslation("chat")
	const hasTicket = Boolean(ticket.externalId || ticket.title)
	const shownStatus = shownMissionStatus(status, now)

	return (
		<MessageBubble className={className} variant="soft">
			<MessageBubbleContent className={MESSAGE_BUBBLE_INTERACTIVE}>
				<TooltipHint content={shownStatus?.text}>
					<button
						aria-label={t("missions.card.open", { objective })}
						className={cn(
							"absolute rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
							MESSAGE_BUBBLE_PADDING_INSET,
						)}
						onClick={() => onOpen(id)}
						type="button"
					/>
				</TooltipHint>
				<span
					className="flex flex-col gap-2"
					data-closed={isClosed}
					data-slot="mission-card"
				>
					{isWorking ? (
						<span className="sr-only">{t("missions.live")}</span>
					) : null}
					<MissionTitleRow state={state} tools={tools} />
					<span className="flex flex-col gap-1">
						<span
							className={cn(
								"wrap-break-word",
								isClosed && "text-muted-foreground",
							)}
							data-slot="mission-objective"
						>
							{objective}
						</span>
						{hasTicket ? <MissionTicketLine ticket={ticket} /> : null}
					</span>
					{shownStatus ? (
						<span
							className="flex flex-col text-muted-foreground text-xs"
							data-slot="mission-status"
						>
							<span className="line-clamp-3 wrap-break-word">
								{shownStatus.text}
							</span>
							<MissionStatusTime status={shownStatus} />
						</span>
					) : null}
				</span>
			</MessageBubbleContent>
		</MessageBubble>
	)
}

export { MissionCard, type MissionCardProps }
