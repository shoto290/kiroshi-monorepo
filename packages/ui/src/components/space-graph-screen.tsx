import { useTranslation } from "react-i18next"

import { AppHeader } from "@workspace/ui/components/app-header"
import { Icons } from "@workspace/ui/components/icons"
import {
	SpaceGraph,
	type SpaceGraphProps,
} from "@workspace/ui/components/space-graph"
import { Button } from "@workspace/ui/components/ui/button"

type SpaceGraphScreenProps = Pick<SpaceGraphProps, "graph"> & {
	onBack: () => void
	insetWindowControls?: boolean
	dragRegion?: "deep"
}

const SpaceGraphScreen = ({
	graph,
	onBack,
	insetWindowControls,
	dragRegion,
}: SpaceGraphScreenProps) => {
	const { t } = useTranslation("common")

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-slot="space-graph-screen"
		>
			<AppHeader
				data-tauri-drag-region={dragRegion}
				insetWindowControls={insetWindowControls}
				leading={
					<>
						<Button
							aria-label={t("spaceGraph.back")}
							onClick={onBack}
							size="icon"
							variant="ghost"
						>
							<Icons.Previous aria-hidden="true" />
						</Button>
						<h1 className="min-w-0 truncate">{t("spaceGraph.title")}</h1>
					</>
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col p-3">
				<SpaceGraph graph={graph} />
			</div>
		</div>
	)
}

export { SpaceGraphScreen }
