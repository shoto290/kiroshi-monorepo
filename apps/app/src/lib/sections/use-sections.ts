import {
	type BotSections,
	createSectionsController,
	type SectionsController,
	type SectionsState,
} from "./sections-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type Sections = {
	state: SectionsState
	controller: SectionsController
}

export const useSections = (
	store: TranscriptStore,
	bots: BotSections,
): Sections => useController(() => createSectionsController(store, bots))
