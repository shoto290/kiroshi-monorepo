import { useMemo } from "react"

import type { MissionEventModel } from "@workspace/ui/components/mission"
import { Notice } from "@workspace/ui/components/notice"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { ActivityPanel } from "@/components/thread-routines"
import { ThreadScreen } from "@/components/thread-screen"
import { useRosterClock } from "@/lib/bots/use-roster-clock"
import type { AttachmentsController } from "@/lib/chat/attachments-controller"
import type { DraftsController } from "@/lib/chat/drafts-controller"
import type { Thread } from "@/lib/chat/thread-contract"
import type { ConversationRuntimes } from "@/lib/conversations/conversation-runtimes"
import type { Bot } from "@/lib/conversations/store-contract"
import type { Mission } from "@/lib/missions/mission-contract"
import { toMissionConversation } from "@/lib/missions/mission-thread-model"
import { useMissionDetail } from "@/lib/missions/use-mission-detail"
import { useMissionReadFailure } from "@/lib/missions/use-mission-failure-notices"

type MissionReadFailureProps = {
	onRetry: () => void
}

const MissionReadFailure = ({ onRetry }: MissionReadFailureProps) => {
	const t = useChatCopy()

	return (
		<Notice
			description={t("missions.failure.read.description")}
			retry={{ onRetry }}
			title={t("missions.failure.read.title")}
		/>
	)
}

type OpenedMissionProps = {
	activityPanel: ActivityPanel
	mission: Mission
	bot: Bot
	bots: Bot[]
	events: MissionEventModel[]
	hasFailedToRead: boolean
	runtimes: ConversationRuntimes
	attachments: AttachmentsController
	drafts: DraftsController
	readerName: string
	onLeave: () => void
	onOpenMission: (missionId: string) => void
}

const OpenedMission = ({
	activityPanel,
	mission,
	bot,
	bots,
	events,
	hasFailedToRead,
	runtimes,
	attachments,
	drafts,
	readerName,
	onLeave,
	onOpenMission,
}: OpenedMissionProps) => {
	const now = useRosterClock()

	useMissionReadFailure(hasFailedToRead)

	const thread = useMemo<Thread>(
		() => ({
			kind: "conversation",
			conversation: toMissionConversation({ mission, bot }),
			runtimes,
			isSettingsOpen: false,
			onOpenSettings: () => undefined,
			mission: { mission, events, now, onLeave },
		}),
		[mission, bot, events, now, runtimes, onLeave],
	)

	return (
		<ThreadScreen
			activityPanel={activityPanel}
			attachments={attachments}
			bots={bots}
			drafts={drafts}
			onOpenMission={onOpenMission}
			readerName={readerName}
			runtimes={runtimes}
			thread={thread}
		/>
	)
}

type MissionThreadScreenProps = {
	activityPanel: ActivityPanel
	missionId: string
	bots: Bot[]
	runtimes: ConversationRuntimes
	attachments: AttachmentsController
	drafts: DraftsController
	readerName: string
	onLeave: () => void
	onOpenMission: (missionId: string) => void
}

export function MissionThreadScreen({
	activityPanel,
	missionId,
	bots,
	runtimes,
	attachments,
	drafts,
	readerName,
	onLeave,
	onOpenMission,
}: MissionThreadScreenProps) {
	const { read, hasFailedToRead, onRetry } = useMissionDetail(missionId)

	const bot = read
		? bots.find(({ id }) => id === read.mission.botId)
		: undefined

	if (!read || !bot) {
		return hasFailedToRead ? <MissionReadFailure onRetry={onRetry} /> : null
	}

	return (
		<OpenedMission
			activityPanel={activityPanel}
			attachments={attachments}
			bot={bot}
			bots={bots}
			drafts={drafts}
			events={read.events}
			hasFailedToRead={hasFailedToRead}
			mission={read.mission}
			onLeave={onLeave}
			onOpenMission={onOpenMission}
			readerName={readerName}
			runtimes={runtimes}
		/>
	)
}
