import { useTranslation } from "react-i18next"

import { AppHeader } from "@workspace/ui/components/app-header"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { Button } from "@workspace/ui/components/button"
import { Icons } from "@workspace/ui/components/icons"
import {
	type MissionBot,
	type MissionState,
	type MissionTicketLink,
	missionBadgeFor,
} from "@workspace/ui/components/mission"
import {
	MissionTicketLine,
	MissionToolMark,
} from "@workspace/ui/components/mission-marks"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"
import { toRelativeTime } from "@workspace/ui/lib/relative-time"
import { cn } from "@workspace/ui/lib/utils"

const MISSION_HEADER_AVATAR_SIZE = 24

type MissionHeaderProps = {
	bot: MissionBot
	objective: string
	ticket: MissionTicketLink
	tools: string[]
	state: MissionState
	openedAt: number
	now: number
	onBack: () => void
	className?: string
}

const MissionHeader = ({
	bot,
	objective,
	ticket,
	tools,
	state,
	openedAt,
	now,
	onBack,
	className,
}: MissionHeaderProps) => {
	const { t, i18n } = useTranslation("chat")
	const hasTicket = Boolean(ticket.externalId || ticket.title)
	const hasTools = tools.length > 0

	return (
		<div
			className={cn("flex w-full shrink-0 flex-col", className)}
			data-slot="mission-header"
		>
			<AppHeader
				leading={
					<>
						<Button
							aria-label={t("missions.header.back")}
							onClick={onBack}
							size="icon"
							variant="ghost"
						>
							<Icons.Previous aria-hidden="true" />
						</Button>
						<BotIdentityAvatar
							animal={bot.animal}
							badge={missionBadgeFor(state)}
							blot={bot.blot}
							image={bot.image}
							name={bot.name}
							seed={bot.seed}
							size={MISSION_HEADER_AVATAR_SIZE}
						/>
						<span className="min-w-0 truncate" data-slot="mission-objective">
							{objective}
						</span>
					</>
				}
				trailing={<MissionStatePill state={state} />}
			/>
			<div
				className="flex h-8.5 shrink-0 items-center gap-2 border-border border-b pe-4 ps-12.5"
				data-slot="mission-ticket-band"
			>
				{hasTicket ? <MissionTicketLine layout="line" ticket={ticket} /> : null}
				{hasTicket && hasTools ? (
					<span
						aria-hidden="true"
						className="h-3 w-px shrink-0 bg-border"
						data-slot="mission-ticket-rule"
					/>
				) : null}
				{hasTools ? (
					<ul
						aria-label={t("missions.header.tools")}
						className="flex shrink-0 items-center gap-2"
					>
						{tools.map((tool) => (
							<li className="flex" key={tool}>
								<MissionToolMark className="size-3" tool={tool} />
							</li>
						))}
					</ul>
				) : null}
				<time
					className="ms-auto shrink-0 text-[11px] text-muted-foreground leading-4 tabular-nums"
					dateTime={new Date(openedAt).toISOString()}
				>
					{t("missions.header.openedAt", {
						time: toRelativeTime(openedAt, i18n.language, now),
					})}
				</time>
			</div>
		</div>
	)
}

export { MissionHeader, type MissionHeaderProps }
