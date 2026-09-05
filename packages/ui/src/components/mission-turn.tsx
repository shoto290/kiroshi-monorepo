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
import { TURN_AVATAR_SIZE } from "@workspace/ui/components/turn"
import { cn } from "@workspace/ui/lib/utils"

type MissionTurnProps = {
	mission: MissionCardModel
	onOpen: (missionId: string) => void
}

const MissionTurn = ({ mission, onOpen }: MissionTurnProps) => {
	const { t } = useTranslation("chat")
	const { bot, id, isClosed, objective, state, ticket, tools } = mission
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
						"col-start-2 row-start-1 pb-1",
						MESSAGE_BUBBLE_INLINE_PADDING,
					)}
				/>
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
					id={id}
					isClosed={isClosed}
					objective={objective}
					onOpen={onOpen}
					state={state}
					ticket={ticket}
					tools={tools}
				/>
			</MessageContent>
		</Message>
	)
}

export { MissionTurn, type MissionTurnProps }
