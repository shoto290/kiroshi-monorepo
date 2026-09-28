import type { CSSProperties } from "react"

import {
	OUTER,
	roundedHexagonPath,
} from "@workspace/ui/components/kiroshi-hexagon"

const SILHOUETTE_SIDE = OUTER.halfWidth * 2

const SILHOUETTE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${SILHOUETTE_SIDE} ${SILHOUETTE_SIDE}'><path d='${roundedHexagonPath(OUTER)}'/></svg>`,
)}")`

const COMPANION_SILHOUETTE: CSSProperties = {
	maskImage: SILHOUETTE_MASK,
	maskSize: "100% 100%",
	maskRepeat: "no-repeat",
}

const SILHOUETTE_FOCUS_RING =
	"outline-none focus-visible:[filter:drop-shadow(0_0_1px_var(--ring))_drop-shadow(0_0_1px_var(--ring))_drop-shadow(0_0_1px_var(--ring))]"

export { COMPANION_SILHOUETTE, SILHOUETTE_FOCUS_RING }
