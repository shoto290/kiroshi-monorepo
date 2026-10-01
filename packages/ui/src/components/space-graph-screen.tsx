import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { Notice } from "@workspace/ui/components/notice"
import { SpaceGraph } from "@workspace/ui/components/space-graph"
import type { SpaceGraphData } from "@workspace/ui/components/space-graph-model"

type SpaceGraphFailure =
	| { read: "bots" }
	| { read: "skills" | "applications" | "history"; botName: string }

type SpaceGraphScreenState =
	| { status: "loading" }
	| { status: "failed"; failures: SpaceGraphFailure[] }
	| { status: "ready"; graph: SpaceGraphData }

type SpaceGraphScreenProps = {
	state: SpaceGraphScreenState
	onClose: () => void
}

type SpaceGraphStateProps = Pick<SpaceGraphScreenProps, "state">

const useEscapeKey = (onEscape: () => void) => {
	const reach = useRef(onEscape)
	reach.current = onEscape

	useEffect(() => {
		const press = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return
			reach.current()
		}
		window.addEventListener("keydown", press)
		return () => window.removeEventListener("keydown", press)
	}, [])
}

const SpaceGraphState = ({ state }: SpaceGraphStateProps) => {
	const { t } = useTranslation("common")

	if (state.status === "ready") {
		return <SpaceGraph graph={state.graph} />
	}

	if (state.status === "failed") {
		return (
			<Notice
				description={state.failures
					.map((failure) =>
						failure.read === "bots"
							? t("spaceGraph.failed.bots")
							: t(`spaceGraph.failed.${failure.read}`, {
									name: failure.botName,
								}),
					)
					.join(" ")}
				title={t("spaceGraph.failed.title")}
			/>
		)
	}

	return (
		<p
			className="m-auto flex items-center gap-2 text-muted-foreground text-sm"
			data-slot="space-graph-reading"
			role="status"
		>
			<Icons.Loading
				aria-hidden="true"
				className="size-4 animate-spin motion-reduce:animate-none"
			/>
			{t("spaceGraph.reading")}
		</p>
	)
}

const SpaceGraphScreen = ({ state, onClose }: SpaceGraphScreenProps) => {
	useEscapeKey(onClose)

	return (
		<div
			className="flex min-h-0 flex-1 flex-col p-3"
			data-slot="space-graph-screen"
		>
			<SpaceGraphState state={state} />
		</div>
	)
}

export { type SpaceGraphFailure, SpaceGraphScreen, type SpaceGraphScreenState }
