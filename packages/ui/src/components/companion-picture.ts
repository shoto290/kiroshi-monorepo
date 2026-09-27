import type { CSSProperties } from "react"

import {
	OUTER,
	roundedHexagonPath,
} from "@workspace/ui/components/kiroshi-hexagon"

const PICTURE_RADIUS_RATIO = 0.25

const MIN_PICTURE_RADIUS = 6

const companionPictureRadius = (size: number) =>
	Math.max(MIN_PICTURE_RADIUS, size * PICTURE_RADIUS_RATIO)

const SILHOUETTE_SIDE = OUTER.halfWidth * 2

const SILHOUETTE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${SILHOUETTE_SIDE} ${SILHOUETTE_SIDE}'><path d='${roundedHexagonPath(OUTER)}'/></svg>`,
)}")`

const COMPANION_SILHOUETTE: CSSProperties = {
	maskImage: SILHOUETTE_MASK,
	maskSize: "100% 100%",
	maskRepeat: "no-repeat",
}

export { COMPANION_SILHOUETTE, companionPictureRadius }
