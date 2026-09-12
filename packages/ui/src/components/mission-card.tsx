"use client"

import { useTranslation } from "react-i18next"

import {
	MESSAGE_BUBBLE_INTERACTIVE,
	MESSAGE_BUBBLE_PADDING_INSET,
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import type { MissionCardModel } from "@workspace/ui/components/mission"
import {
	MissionTicketLine,
	MissionToolMark,
} from "@workspace/ui/components/mission-marks"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"
import { cn } from "@workspace/ui/lib/utils"

type MissionCardProps = Omit<MissionCardModel, "author" | "identity"> & {
	onOpen: (missionId: string) => void
	className?: string
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
	const hasTicket = Boolean(ticket.externalId || ticket.title)

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
						{hasTicket ? <MissionTicketLine ticket={ticket} /> : null}
					</span>
				</span>
			</MessageBubbleContent>
		</MessageBubble>
	)
}

export { MissionCard, type MissionCardProps }
