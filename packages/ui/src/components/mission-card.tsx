"use client"

import { useTranslation } from "react-i18next"

import {
	MESSAGE_BUBBLE_PADDING_INSET,
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import type {
	MissionCardModel,
	MissionTicketLink,
} from "@workspace/ui/components/mission"
import { missionTicketPlatformMark } from "@workspace/ui/components/mission-marks"
import { cn } from "@workspace/ui/lib/utils"

type MissionCardProps = Pick<
	MissionCardModel,
	"id" | "objective" | "ticket" | "isClosed"
> & {
	onOpen: (missionId: string) => void
	className?: string
}

const MISSION_TICKET_LINE =
	"flex w-fit max-w-full flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs"

type MissionTicketLineProps = {
	ticket: MissionTicketLink
}

const MissionTicketLine = ({ ticket }: MissionTicketLineProps) => {
	const Mark = missionTicketPlatformMark(ticket.platform)
	const line = (
		<>
			<Mark aria-hidden="true" className="size-3 shrink-0" />
			<span className="min-w-0 wrap-break-word tabular-nums">
				{ticket.externalId}
			</span>
			<span className="min-w-0 wrap-break-word">{ticket.title}</span>
		</>
	)

	if (!ticket.url) {
		return (
			<span className={MISSION_TICKET_LINE} data-slot="mission-ticket-line">
				{line}
			</span>
		)
	}

	return (
		<a
			className={cn("relative", MISSION_TICKET_LINE)}
			data-slot="mission-ticket-line"
			href={ticket.url}
			rel="noreferrer noopener"
			target="_blank"
		>
			{line}
		</a>
	)
}

const MissionCard = ({
	id,
	objective,
	ticket,
	isClosed,
	onOpen,
	className,
}: MissionCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<MessageBubble className={className} variant="soft">
			<MessageBubbleContent>
				<button
					aria-label={t("missions.card.open", { objective })}
					className={cn(
						"absolute rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
						MESSAGE_BUBBLE_PADDING_INSET,
					)}
					onClick={() => onOpen(id)}
					type="button"
				/>
				<span
					className="flex flex-col gap-1"
					data-closed={isClosed}
					data-slot="mission-card"
				>
					<span
						className={cn(
							"wrap-break-word",
							isClosed && "text-muted-foreground",
						)}
						data-slot="mission-objective"
					>
						{objective}
					</span>
					<MissionTicketLine ticket={ticket} />
				</span>
			</MessageBubbleContent>
		</MessageBubble>
	)
}

export { MissionCard, type MissionCardProps }
