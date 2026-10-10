import type { CSSProperties } from "react"

import { COMPANION_OUTLINE } from "@workspace/ui/components/companion-avatar"

const SILHOUETTE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${COMPANION_OUTLINE.side} ${COMPANION_OUTLINE.side}'><path d='${COMPANION_OUTLINE.path}'/></svg>`,
)}")`

const COMPANION_SILHOUETTE: CSSProperties = {
	maskImage: SILHOUETTE_MASK,
	maskSize: "100% 100%",
	maskRepeat: "no-repeat",
}

const SILHOUETTE_FOCUS_RING =
	"outline-none focus-visible:[filter:drop-shadow(0_0_1px_var(--ring))_drop-shadow(0_0_1px_var(--ring))_drop-shadow(0_0_1px_var(--ring))]"

export { COMPANION_SILHOUETTE, SILHOUETTE_FOCUS_RING }
