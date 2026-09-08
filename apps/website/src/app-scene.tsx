import { type ReactNode, useState } from "react"

import { ActivityIndicator } from "@workspace/ui/components/activity-indicator"
import { AppHeader } from "@workspace/ui/components/app-header"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { Button } from "@workspace/ui/components/button"
import { ContentCard } from "@workspace/ui/components/content-card"
import { Icons } from "@workspace/ui/components/icons"
import { Mention } from "@workspace/ui/components/mention"
import { MissionTurn } from "@workspace/ui/components/mission-turn"
import { AnimatedSidebarProvider } from "@workspace/ui/components/motion/animated-sidebar"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import { RosterProvider } from "@workspace/ui/components/roster"
import { ThreadLayout } from "@workspace/ui/components/thread-layout"
import type { TranscriptItem } from "@workspace/ui/components/transcript"
import { AssistantTurn, UserTurn } from "@workspace/ui/components/turn"

import { SCENE_COPY } from "./copy"
import {
	CONVERSATION_ID,
	HAPPY,
	ICHI,
	MISSION,
	NI,
	ROSTER_CONVERSATIONS,
	ROSTER_ROWS,
	SCENE_BOTS,
	SELECTED_SPACE_ID,
	SPACES,
} from "./scene-cast"
import { type SceneThread, threadOf } from "./scene-threads"
import { type SceneFrame, useSceneTimeline } from "./use-scene-timeline"
import { WindowControls } from "./window-controls"

const SHELL = "relative h-[688px] w-full"

const TRANSCRIPT_INSET = "pt-4"

const ENTER =
	"animate-in fade-in slide-in-from-bottom-1 duration-[180ms] ease-out"

const openMission = () => {}

type SceneRowProps = {
	isAnimated: boolean
	opacity?: number
	children: ReactNode
}

const SceneRow = ({ isAnimated, opacity = 1, children }: SceneRowProps) => (
	<div
		className={isAnimated ? ENTER : undefined}
		style={opacity === 1 ? undefined : { opacity }}
	>
		{children}
	</div>
)

const sceneRow = (
	key: string,
	body: ReactNode,
	opacity = 1,
	isAnimated = false,
): TranscriptItem => ({
	key,
	render: () => (
		<SceneRow isAnimated={isAnimated} opacity={opacity}>
			{body}
		</SceneRow>
	),
})

const scriptedRows = (
	frame: SceneFrame,
	isAnimated: boolean,
): TranscriptItem[] => {
	const rows: TranscriptItem[] = []

	if (frame.openingOpacity > 0) {
		rows.push(
			sceneRow(
				"opening",
				<AssistantTurn author={HAPPY}>{SCENE_COPY.opening}</AssistantTurn>,
				frame.openingOpacity,
				isAnimated,
			),
		)
	}

	if (frame.requestOpacity > 0) {
		rows.push(
			sceneRow(
				"request",
				<UserTurn>
					<Mention botId={ICHI.id} />
					<Mention botId={NI.id} />
					{SCENE_COPY.request}
				</UserTurn>,
				frame.requestOpacity,
				isAnimated,
			),
		)
	}

	if (frame.hasIchiAnswer) {
		rows.push(
			sceneRow(
				"ichi-answer",
				<AssistantTurn author={ICHI}>
					{SCENE_COPY.ichiAnswer.slice(0, frame.ichiTyped)}
				</AssistantTurn>,
				frame.closingOpacity,
				isAnimated,
			),
		)
	}

	if (frame.hasNiAnswer) {
		rows.push(
			sceneRow(
				"ni-answer",
				<AssistantTurn author={NI}>
					{SCENE_COPY.niAnswer.slice(0, frame.niTyped)}
				</AssistantTurn>,
				frame.closingOpacity,
				isAnimated,
			),
		)
	}

	if (frame.hasMission) {
		rows.push(
			sceneRow(
				"mission",
				<MissionTurn mission={MISSION} onOpen={openMission} />,
				frame.closingOpacity,
				isAnimated,
			),
		)
	}

	return rows
}

const threadRows = (thread: SceneThread): TranscriptItem[] => [
	sceneRow("ask", <UserTurn>{thread.ask}</UserTurn>),
	sceneRow(
		"answer",
		<AssistantTurn author={thread.bot}>{thread.answer}</AssistantTurn>,
	),
]

type WorkingRowsProps = {
	frame: SceneFrame
	isAnimated: boolean
}

const WorkingRows = ({ frame, isAnimated }: WorkingRowsProps) => (
	<>
		{frame.hasIchiAnswer ? null : (
			<SceneRow isAnimated={isAnimated}>
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
			<SceneRow isAnimated={isAnimated}>
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
	const { frame, isStill, engage } = useSceneTimeline({
		onIdle: () => setSelectedId(CONVERSATION_ID),
	})
	const select = (id: string) => {
		engage()
		setSelectedId(id)
	}
	const thread = threadOf(selectedId)
	const isAnimated = !isStill && thread === undefined

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
				<AnimatedSidebarProvider className="h-full" defaultOpen>
					<AppSidebar
						bots={ROSTER_ROWS}
						conversations={ROSTER_CONVERSATIONS}
						insetWindowControls
						onSelectBot={select}
						onSelectConversation={select}
						panelClassName="h-full"
						selectedBotId={thread ? selectedId : undefined}
						selectedConversationId={thread ? undefined : CONVERSATION_ID}
						selectedSpaceId={SELECTED_SPACE_ID}
						spaces={SPACES}
					/>
					<ContentCard isLandmark={false}>
						<ThreadLayout
							autoScroll={false}
							className="h-full"
							composer={
								<PromptInput placeholder={SCENE_COPY.composerPlaceholder} />
							}
							contentClassName={TRANSCRIPT_INSET}
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
							rows={
								thread ? threadRows(thread) : scriptedRows(frame, isAnimated)
							}
						>
							{thread ? null : (
								<WorkingRows frame={frame} isAnimated={isAnimated} />
							)}
						</ThreadLayout>
					</ContentCard>
				</AnimatedSidebarProvider>
			</RosterProvider>
		</section>
	)
}
