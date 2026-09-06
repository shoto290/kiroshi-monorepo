import { useTranslation } from "react-i18next"

import { BotTitleBadge } from "@workspace/ui/components/badge"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { MessageHeader } from "@workspace/ui/components/message"
import {
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import type {
	MissionBot,
	MissionEventModel,
} from "@workspace/ui/components/mission"
import {
	isNamedMissionTool,
	MissionToolMark,
} from "@workspace/ui/components/mission-marks"
import { toRelativeTime } from "@workspace/ui/lib/relative-time"

const MISSION_EVENT_GUTTER_SIZE = 40

type MissionEventRowProps = {
	event: MissionEventModel
	bot: MissionBot
	now: number
}

type MissionEventTimeProps = Omit<MissionEventRowProps, "bot">

const MissionEventTime = ({ event, now }: MissionEventTimeProps) => {
	const { i18n } = useTranslation("chat")

	return (
		<time
			className="ms-auto shrink-0 text-[11px] leading-4 tabular-nums"
			dateTime={new Date(event.createdAt).toISOString()}
		>
			{toRelativeTime(event.createdAt, i18n.language, now)}
		</time>
	)
}

const MissionMachineLine = ({ event, now }: MissionEventTimeProps) => {
	const { t } = useTranslation("chat")

	return (
		<p
			className="flex h-5 w-full min-w-0 items-center gap-2 px-1 text-muted-foreground text-xs leading-4"
			data-slot="mission-machine-line"
		>
			<span
				aria-hidden="true"
				className="size-[5px] shrink-0 rounded-full bg-muted-foreground/45"
			/>
			<span className="min-w-0 flex-1 truncate">
				{t(`missions.event.line.${event.kind}`, { source: event.source })}
			</span>
			<MissionEventTime event={event} now={now} />
		</p>
	)
}

type MissionEventGutterProps = {
	source: string
	bot: MissionBot
}

const MissionEventGutter = ({ source, bot }: MissionEventGutterProps) => {
	if (isNamedMissionTool(source)) {
		return (
			<span
				className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"
				data-gutter="tool"
				data-slot="mission-event-gutter"
			>
				<MissionToolMark className="size-[18px]" tool={source} />
			</span>
		)
	}

	return (
		<span
			className="flex shrink-0"
			data-gutter="bot"
			data-slot="mission-event-gutter"
		>
			<BotIdentityAvatar
				animal={bot.animal}
				blot={bot.blot}
				image={bot.image}
				name={bot.name}
				seed={bot.seed}
				size={MISSION_EVENT_GUTTER_SIZE}
			/>
		</span>
	)
}

const MissionAuthoredEvent = ({ event, bot, now }: MissionEventRowProps) => {
	const { t } = useTranslation("chat")

	return (
		<div
			className="flex w-full min-w-0 items-end gap-2"
			data-slot="mission-authored-event"
		>
			<MissionEventGutter bot={bot} source={event.source} />
			<div className="flex min-w-0 max-w-[75%] flex-col gap-1">
				<MessageHeader className="min-w-0">
					<span className="min-w-0 truncate font-medium text-foreground/80">
						{event.source}
					</span>
					<BotTitleBadge
						className={
							event.kind === "agent_asked"
								? "bg-bot-badge-attention/18"
								: undefined
						}
						title={t(`missions.event.kind.${event.kind}`)}
					/>
					<MissionEventTime event={event} now={now} />
				</MessageHeader>
				<MessageBubble variant="soft">
					<MessageBubbleContent>{event.text}</MessageBubbleContent>
				</MessageBubble>
			</div>
		</div>
	)
}

const MissionEventRow = ({ event, bot, now }: MissionEventRowProps) => (
	<div className="w-full min-w-0" data-slot="mission-event-row">
		{event.text === undefined ? (
			<MissionMachineLine event={event} now={now} />
		) : (
			<MissionAuthoredEvent bot={bot} event={event} now={now} />
		)}
	</div>
)

export { MissionEventRow, type MissionEventRowProps }
