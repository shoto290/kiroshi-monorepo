"use client"

import { useTranslation } from "react-i18next"

import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import {
	Message,
	MessageAuthor,
	MessageContent,
} from "@workspace/ui/components/message"
import { MESSAGE_BUBBLE_INLINE_PADDING } from "@workspace/ui/components/message-bubble"
import {
	type MissionCardModel,
	missionBadgeFor,
} from "@workspace/ui/components/mission"
import { MissionCard } from "@workspace/ui/components/mission-card"
import { missionToolMark } from "@workspace/ui/components/mission-marks"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"
import { TURN_AVATAR_SIZE } from "@workspace/ui/components/turn"
import { cn } from "@workspace/ui/lib/utils"

type MissionToolMarkProps = {
	tool: string
}

const MissionToolMark = ({ tool }: MissionToolMarkProps) => {
	const Mark = missionToolMark(tool)

	return (
		<span
			aria-label={tool}
			className="inline-flex size-3 shrink-0 items-center justify-center text-muted-foreground"
			data-slot="mission-tool-mark"
			role="img"
		>
			<Mark aria-hidden="true" className="size-full" />
		</span>
	)
}

type MissionTurnProps = {
	mission: MissionCardModel
	onOpen: (missionId: string) => void
}

const MissionTurn = ({ mission, onOpen }: MissionTurnProps) => {
	const { t } = useTranslation("chat")
	const { bot, state, tools } = mission
	const isWorking = state === "working"

	return (
		<Message aria-label={t("transcript.message.mission")} from="assistant">
			<MessageContent
				className="grid gap-x-2 gap-y-0"
				style={{ gridTemplateColumns: `${TURN_AVATAR_SIZE}px 1fr` }}
			>
				<MessageAuthor
					author={bot}
					className={cn(
						"col-start-2 row-start-1 flex-wrap pb-1",
						MESSAGE_BUBBLE_INLINE_PADDING,
					)}
				>
					{isWorking ? null : <MissionStatePill state={state} />}
					{tools.map((tool) => (
						<MissionToolMark key={tool} tool={tool} />
					))}
				</MessageAuthor>
				<span
					aria-hidden="true"
					className="col-start-1 row-start-2 self-end"
					data-slot="message-gutter"
				>
					<BotIdentityAvatar
						animal={bot.animal}
						badge={missionBadgeFor(state)}
						blot={bot.blot}
						image={bot.image}
						kind="working"
						name={bot.name}
						seed={bot.id}
						size={TURN_AVATAR_SIZE}
						working={isWorking}
					/>
				</span>
				<MissionCard
					className="col-start-2 row-start-2 min-w-0"
					id={mission.id}
					isClosed={mission.isClosed}
					objective={mission.objective}
					onOpen={onOpen}
					ticket={mission.ticket}
				/>
			</MessageContent>
		</Message>
	)
}

export { MissionTurn, type MissionTurnProps }
