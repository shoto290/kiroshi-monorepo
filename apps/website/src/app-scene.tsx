import { type ReactNode, useState } from "react"

import { ActivityIndicator } from "@workspace/ui/components/activity-indicator"
import { AppHeader } from "@workspace/ui/components/app-header"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { Button } from "@workspace/ui/components/button"
import { Icons } from "@workspace/ui/components/icons"
import { Markdown } from "@workspace/ui/components/markdown"
import { MissionTurn } from "@workspace/ui/components/mission-turn"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import { RosterProvider } from "@workspace/ui/components/roster"
import { ThreadLayout } from "@workspace/ui/components/thread-layout"
import type { TranscriptItem } from "@workspace/ui/components/transcript"
import { AssistantTurn, UserTurn } from "@workspace/ui/components/turn"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

import { SCENE_COPY } from "./copy"
import {
	CONVERSATION_ID,
	HAPPY,
	ICHI,
	MISSION,
	NI,
	READER,
	ROSTER_CONVERSATIONS,
	ROSTER_ROWS,
	SCENE_BOTS,
	SELECTED_SPACE,
	SPACES,
} from "./scene-cast"
import { type SceneThread, threadOf } from "./scene-threads"
import { type SceneFrame, useSceneTimeline } from "./use-scene-timeline"
import { WindowControls } from "./window-controls"

const SHELL = "relative h-[688px] w-full"

const ROW_ENTER =
	"animate-in slide-in-from-bottom-1 duration-[180ms] ease-out motion-reduce:animate-none"

const openMission = () => {}

type SceneRowProps = {
	opacity?: number
	children: ReactNode
}

const SceneRow = ({ opacity = 1, children }: SceneRowProps) => (
	<div className={ROW_ENTER} style={opacity === 1 ? undefined : { opacity }}>
		{children}
	</div>
)

const sceneRow = (
	key: string,
	body: ReactNode,
	opacity = 1,
): TranscriptItem => ({
	key,
	render: () => <SceneRow opacity={opacity}>{body}</SceneRow>,
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
				<MissionTurn mission={MISSION} onOpen={openMission} />,
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

type WorkingRowsProps = {
	frame: SceneFrame
}

const WorkingRows = ({ frame }: WorkingRowsProps) => (
	<>
		{frame.hasIchiAnswer ? null : (
			<SceneRow>
				<ActivityIndicator
					animal={ICHI.animal}
					blot={ICHI.blot}
					botId={ICHI.id}
					elapsedSeconds={frame.elapsedSeconds}
					kind="thinking"
					name={ICHI.name}
					seed={ICHI.id}
				/>
			</SceneRow>
		)}
		{frame.hasNiAnswer ? null : (
			<SceneRow>
				<ActivityIndicator
					animal={NI.animal}
					blot={NI.blot}
					botId={NI.id}
					elapsedSeconds={frame.elapsedSeconds}
					kind={frame.hasIchiAnswer ? "writing" : "thinking"}
					name={NI.name}
					seed={NI.id}
				/>
			</SceneRow>
		)}
	</>
)

export const AppScene = () => {
	const [selectedId, setSelectedId] = useState(CONVERSATION_ID)
	const { frame, engage } = useSceneTimeline({
		onIdle: () => setSelectedId(CONVERSATION_ID),
	})
	const select = (id: string) => {
		engage()
		setSelectedId(id)
	}
	const thread = threadOf(selectedId)

	return (
		<section
			aria-label={SCENE_COPY.sceneLabel}
			className={SHELL}
			onFocus={engage}
			onKeyDown={engage}
			onPointerDown={engage}
			onPointerMove={engage}
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
							conversations={ROSTER_CONVERSATIONS}
							insetWindowControls
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
					<ThreadLayout
						autoScroll={false}
						className="h-full"
						composer={
							<PromptInput placeholder={SCENE_COPY.composerPlaceholder} />
						}
						header={
							<AppHeader
								leading={thread ? thread.bot.name : SCENE_COPY.threadTitle}
								trailing={
									<Button
										aria-label={SCENE_COPY.panelAction}
										size="icon-sm"
										variant="ghost"
									>
										<Icons.SidePanel />
									</Button>
								}
							/>
						}
						rows={thread ? threadRows(thread) : scriptedRows(frame)}
					>
						{thread ? null : <WorkingRows frame={frame} />}
					</ThreadLayout>
				</WorkspaceShell>
			</RosterProvider>
		</section>
	)
}
