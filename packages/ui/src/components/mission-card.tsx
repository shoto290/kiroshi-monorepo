"use client"

import { useTranslation } from "react-i18next"

import {
	MESSAGE_BUBBLE_INTERACTIVE,
	MESSAGE_BUBBLE_PADDING_INSET,
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import type {
	MissionCardModel,
	MissionTicketLink,
} from "@workspace/ui/components/mission"
import {
	missionTicketPlatformMark,
	missionToolMark,
} from "@workspace/ui/components/mission-marks"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"
import { cn } from "@workspace/ui/lib/utils"

type MissionCardProps = Omit<MissionCardModel, "author" | "identity"> & {
	onOpen: (missionId: string) => void
	className?: string
}

type MissionToolMarkProps = {
	tool: string
}

const MissionToolMark = ({ tool }: MissionToolMarkProps) => {
	const Mark = missionToolMark(tool)

	return (
		<span
			aria-label={tool}
			className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground"
			data-slot="mission-tool-mark"
			role="img"
		>
			<Mark aria-hidden="true" className="size-full" />
		</span>
	)
}

type MissionTitleRowProps = Pick<MissionCardModel, "state" | "tools">

const MissionTitleRow = ({ state, tools }: MissionTitleRowProps) => {
	const { t } = useTranslation("chat")
	const isWorking = state === "working"
	const stateName = isWorking ? (
		<span className="sr-only">{t(`missions.state.${state}`)}</span>
	) : (
		<MissionStatePill state={state} />
	)

	if (isWorking && tools.length === 0) return stateName

	return (
		<span
			className="flex flex-wrap items-center gap-x-2 gap-y-1"
			data-slot="mission-title-row"
		>
			{tools.map((tool) => (
				<MissionToolMark key={tool} tool={tool} />
			))}
			{stateName}
		</span>
	)
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
			{ticket.externalId ? (
				<span className="shrink-0 font-medium tabular-nums">
					{ticket.externalId}
				</span>
			) : null}
			{ticket.title ? (
				<span className="min-w-0 wrap-break-word">{ticket.title}</span>
			) : null}
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
			className={cn(
				"relative rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
				MISSION_TICKET_LINE,
			)}
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
	state,
	ticket,
	tools,
	isClosed,
	onOpen,
	className,
}: MissionCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<MessageBubble className={className} variant="soft">
			<MessageBubbleContent className={MESSAGE_BUBBLE_INTERACTIVE}>
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
					className="flex flex-col gap-2"
					data-closed={isClosed}
					data-slot="mission-card"
				>
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
						<MissionTicketLine ticket={ticket} />
					</span>
				</span>
			</MessageBubbleContent>
		</MessageBubble>
	)
}

export { MissionCard, type MissionCardProps }
