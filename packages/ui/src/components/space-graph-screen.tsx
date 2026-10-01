import { useEffect, useRef } from "react"

import {
	SpaceGraph,
	type SpaceGraphProps,
} from "@workspace/ui/components/space-graph"

type SpaceGraphScreenProps = Pick<SpaceGraphProps, "graph"> & {
	onClose: () => void
}

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

const SpaceGraphScreen = ({ graph, onClose }: SpaceGraphScreenProps) => {
	useEscapeKey(onClose)

	return (
		<div
			className="flex min-h-0 flex-1 flex-col p-3"
			data-slot="space-graph-screen"
		>
			<SpaceGraph graph={graph} />
		</div>
	)
}

export { SpaceGraphScreen }
