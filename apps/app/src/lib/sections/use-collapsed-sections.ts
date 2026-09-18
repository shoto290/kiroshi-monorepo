import {
	type CollapsedSectionsController,
	type CollapsedSectionsState,
	createCollapsedSectionsController,
} from "./collapsed-sections-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type CollapsedSections = {
	state: CollapsedSectionsState
	controller: CollapsedSectionsController
}

export const useCollapsedSections = (
	store: TranscriptStore,
): CollapsedSections =>
	useController(() => createCollapsedSectionsController(store))
