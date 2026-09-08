import type { ReactNode } from "react"

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
import { type RosterBot, RosterProvider } from "@workspace/ui/components/roster"
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
import { useSceneTimeline } from "./use-scene-timeline"
import { WindowControls } from "./window-controls"

const SHELL = "relative pointer-events-none h-[688px] w-full select-none"

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

export const AppScene = () => {
	const { frame, isStill } = useSceneTimeline()
	const isAnimated = !isStill

	const rows: TranscriptItem[] = []

	if (frame.openingOpacity > 0) {
		rows.push({
			key: "opening",
			render: () => (
				<SceneRow isAnimated={isAnimated} opacity={frame.openingOpacity}>
					<AssistantTurn author={HAPPY}>{SCENE_COPY.opening}</AssistantTurn>
				</SceneRow>
			),
		})
	}

	if (frame.requestOpacity > 0) {
		rows.push({
			key: "request",
			render: () => (
				<SceneRow isAnimated={isAnimated} opacity={frame.requestOpacity}>
					<UserTurn>
						<Mention botId={ICHI.id} />
						<Mention botId={NI.id} />
						{SCENE_COPY.request}
					</UserTurn>
				</SceneRow>
			),
		})
	}

	const answerRow = (
		author: RosterBot,
		answer: string,
		typed: number,
	): TranscriptItem => ({
		key: `${author.id}-answer`,
		render: () => (
			<SceneRow isAnimated={isAnimated} opacity={frame.closingOpacity}>
				<AssistantTurn author={author}>{answer.slice(0, typed)}</AssistantTurn>
			</SceneRow>
		),
	})

	if (frame.hasIchiAnswer) {
		rows.push(answerRow(ICHI, SCENE_COPY.ichiAnswer, frame.ichiTyped))
	}

	if (frame.hasNiAnswer) {
		rows.push(answerRow(NI, SCENE_COPY.niAnswer, frame.niTyped))
	}

	if (frame.hasMission) {
		rows.push({
			key: "mission",
			render: () => (
				<SceneRow isAnimated={isAnimated} opacity={frame.closingOpacity}>
					<MissionTurn mission={MISSION} onOpen={openMission} />
				</SceneRow>
			),
		})
	}

	return (
		<div aria-hidden="true" className={SHELL} inert>
			<WindowControls />
			<RosterProvider bots={SCENE_BOTS}>
				<AnimatedSidebarProvider className="h-full" defaultOpen>
					<AppSidebar
						bots={ROSTER_ROWS}
						conversations={ROSTER_CONVERSATIONS}
						insetWindowControls
						panelClassName="h-full"
						selectedConversationId={CONVERSATION_ID}
						selectedSpaceId={SELECTED_SPACE_ID}
						spaces={SPACES}
					/>
					<ContentCard isLandmark={false}>
						<ThreadLayout
							autoScroll={false}
							className="h-full"
							contentClassName={TRANSCRIPT_INSET}
							composer={
								<PromptInput placeholder={SCENE_COPY.composerPlaceholder} />
							}
							header={
								<AppHeader
									leading={SCENE_COPY.threadTitle}
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
							rows={rows}
						>
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
						</ThreadLayout>
					</ContentCard>
				</AnimatedSidebarProvider>
			</RosterProvider>
		</div>
	)
}
