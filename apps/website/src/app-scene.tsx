import { type ReactNode, useState } from "react"

import { ActivityIndicator } from "@workspace/ui/components/activity-indicator"
import { AppHeader } from "@workspace/ui/components/app-header"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { HeaderConversationButton } from "@workspace/ui/components/header-conversation-button"
import { HeaderIdentityButton } from "@workspace/ui/components/header-identity-button"
import { Markdown } from "@workspace/ui/components/markdown"
import { MissionTurn } from "@workspace/ui/components/mission-turn"
import {
	type PinnedMessage,
	PinnedMessages,
} from "@workspace/ui/components/pinned-messages"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import { RosterProvider } from "@workspace/ui/components/roster"
import type { RoutineRowModel } from "@workspace/ui/components/routine-row"
import {
	type EarlierTodayRow,
	RoutinesPanel,
	RoutinesPanelTrigger,
} from "@workspace/ui/components/routines-panel"
import { ThreadLayout } from "@workspace/ui/components/thread-layout"
import type { TranscriptItem } from "@workspace/ui/components/transcript"
import { AssistantTurn, UserTurn } from "@workspace/ui/components/turn"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

import { SCENE_COPY } from "./copy"
import {
	CONVERSATION_BOTS,
	CONVERSATION_ID,
	CONVERSATIONS_BY_SPACE,
	HAPPY,
	ICHI,
	MISSION,
	NI,
	PANEL_MISSIONS,
	READER,
	ROSTER_BY_SPACE,
	ROSTER_ROWS,
	SCENE_BOTS,
	SELECTED_SPACE,
	SPACES,
} from "./scene-cast"
import { type SceneThread, threadOf } from "./scene-threads"
import { type SceneFrame, useSceneTimeline } from "./use-scene-timeline"
import { WindowControls } from "./window-controls"

const SHELL = "relative size-full"

const ROW_ENTER =
	"animate-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none"

// The fold at 1440x900 reveals 359px of the shell: the scene reclaims one
// spacing step of the thread layout's top padding to keep its newest row inside.
const TRANSCRIPT_INSET = "pt-4"

const NO_PINS: PinnedMessage[] = []

const NO_ROUTINES: RoutineRowModel[] = []

const NO_ACTIVITY: EarlierTodayRow[] = []

const doNothing = () => {}

const sceneRow = (
	key: string,
	body: ReactNode,
	opacity = 1,
): TranscriptItem => ({
	key,
	render: () => (
		<div className={ROW_ENTER} style={opacity === 1 ? undefined : { opacity }}>
			{body}
		</div>
	),
})

const scriptedRows = (frame: SceneFrame): TranscriptItem[] => {
	const rows: TranscriptItem[] = []

	if (frame.openingOpacity > 0) {
		rows.push(
			sceneRow(
				"opening",
				<AssistantTurn author={HAPPY}>
					<Markdown>{SCENE_COPY.opening}</Markdown>
				</AssistantTurn>,
				frame.openingOpacity,
			),
		)
	}

	if (frame.requestOpacity > 0) {
		rows.push(
			sceneRow(
				"request",
				<UserTurn>
					<Markdown>{SCENE_COPY.request}</Markdown>
				</UserTurn>,
				frame.requestOpacity,
			),
		)
	}

	if (frame.hasIchiAnswer && frame.ichiAnswerOpacity > 0) {
		rows.push(
			sceneRow(
				"ichi-answer",
				<AssistantTurn author={ICHI}>
					<Markdown>{SCENE_COPY.ichiAnswer.slice(0, frame.ichiTyped)}</Markdown>
				</AssistantTurn>,
				frame.ichiAnswerOpacity,
			),
		)
	}

	if (frame.hasNiAnswer) {
		rows.push(
			sceneRow(
				"ni-answer",
				<AssistantTurn author={NI}>
					<Markdown>{SCENE_COPY.niAnswer.slice(0, frame.niTyped)}</Markdown>
				</AssistantTurn>,
				frame.closingOpacity,
			),
		)
	}

	if (frame.hasMission) {
		rows.push(
			sceneRow(
				"mission",
				<MissionTurn mission={MISSION} onOpen={doNothing} />,
				frame.closingOpacity,
			),
		)
	}

	return rows
}

const threadRows = (thread: SceneThread): TranscriptItem[] => [
	sceneRow(
		"ask",
		<UserTurn>
			<Markdown>{thread.ask}</Markdown>
		</UserTurn>,
	),
	sceneRow(
		"answer",
		<AssistantTurn author={thread.bot}>
			<Markdown>{thread.answer}</Markdown>
		</AssistantTurn>,
	),
]

type ThreadTitleProps = {
	thread?: SceneThread
	onOpen: () => void
}

const ThreadTitle = ({ thread, onOpen }: ThreadTitleProps) =>
	thread ? (
		<HeaderIdentityButton
			animal={thread.bot.animal}
			blot={thread.bot.blot}
			connection="ready"
			name={thread.bot.name}
			onOpenSettings={onOpen}
			seed={thread.bot.id}
		/>
	) : (
		<HeaderConversationButton
			bots={CONVERSATION_BOTS}
			name={SCENE_COPY.threadTitle}
			onOpenSettings={onOpen}
		/>
	)

type WorkingRowsProps = {
	frame: SceneFrame
}

const WorkingRows = ({ frame }: WorkingRowsProps) => (
	<>
		{frame.hasIchiAnswer ? null : (
			<ActivityIndicator
				animal={ICHI.animal}
				blot={ICHI.blot}
				botId={ICHI.id}
				className={ROW_ENTER}
				elapsedSeconds={frame.elapsedSeconds}
				kind="thinking"
				name={ICHI.name}
				seed={ICHI.id}
			/>
		)}
		{frame.hasNiAnswer ? null : (
			<ActivityIndicator
				animal={NI.animal}
				blot={NI.blot}
				botId={NI.id}
				className={ROW_ENTER}
				elapsedSeconds={frame.elapsedSeconds}
				kind={frame.hasIchiAnswer ? "writing" : "thinking"}
				name={NI.name}
				seed={NI.id}
			/>
		)}
	</>
)

export const AppScene = () => {
	const [selectedId, setSelectedId] = useState(CONVERSATION_ID)
	const [isPanelOpen, setPanelOpen] = useState(false)
	const [draft, setDraft] = useState("")
	const { frame, engage } = useSceneTimeline({
		onIdle: () => {
			setSelectedId(CONVERSATION_ID)
			setPanelOpen(false)
			setDraft("")
		},
	})
	const select = (id: string) => {
		engage()
		setSelectedId(id)
	}
	const openPanel = (isOpen: boolean) => {
		engage()
		setPanelOpen(isOpen)
	}
	const thread = threadOf(selectedId)

	return (
		<section
			aria-label={SCENE_COPY.sceneLabel}
			className={SHELL}
			onFocus={engage}
			onKeyDown={engage}
			onPointerDown={engage}
		>
			<WindowControls />
			<RosterProvider bots={SCENE_BOTS}>
				<WorkspaceShell
					className="h-full"
					defaultOpen
					isLandmark={false}
					sidebar={
						<AppSidebar
							bots={ROSTER_ROWS}
							botsBySpaceId={ROSTER_BY_SPACE}
							conversationsBySpaceId={CONVERSATIONS_BY_SPACE}
							insetWindowControls
							onCreateBot={engage}
							onCreateConversation={engage}
							onOpenSearch={engage}
							onSelectBot={select}
							onSelectConversation={select}
							panelClassName="h-full"
							selectedBotId={thread ? selectedId : undefined}
							selectedConversationId={thread ? undefined : CONVERSATION_ID}
							selectedSpaceId={SELECTED_SPACE.id}
							spaces={SPACES}
							user={READER}
						/>
					}
					spaceTint={SELECTED_SPACE.colour}
				>
					<RoutinesPanel
						failure={null}
						isOpen={isPanelOpen}
						missions={{
							earlierToday: NO_ACTIVITY,
							onOpen: doNothing,
							open: PANEL_MISSIONS,
						}}
						onDelete={doNothing}
						onEnabledChange={doNothing}
						onOpenChange={openPanel}
						onRetry={doNothing}
						routines={NO_ROUTINES}
					>
						<ThreadLayout
							autoScroll={false}
							className="h-full"
							composer={
								<PromptInput
									onValueChange={setDraft}
									placeholder={SCENE_COPY.composerPlaceholder}
									value={draft}
								/>
							}
							contentClassName={TRANSCRIPT_INSET}
							header={
								<AppHeader
									leading={<ThreadTitle onOpen={engage} thread={thread} />}
									trailing={
										<>
											<PinnedMessages
												messages={NO_PINS}
												onJump={doNothing}
												onUnpin={doNothing}
											/>
											<RoutinesPanelTrigger />
										</>
									}
								/>
							}
							rows={thread ? threadRows(thread) : scriptedRows(frame)}
						>
							{thread ? null : <WorkingRows frame={frame} />}
						</ThreadLayout>
					</RoutinesPanel>
				</WorkspaceShell>
			</RosterProvider>
		</section>
	)
}
