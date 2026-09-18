import {
	createSkillsController,
	type SkillsController,
	type SkillsState,
} from "./skills-controller"

import { useController } from "../use-controller"
import type { TranscriptStore } from "../conversations/store-port"

export type BotSkills = {
	state: SkillsState
	controller: SkillsController
}

export const useBotSkills = (store: TranscriptStore): BotSkills =>
	useController(() => createSkillsController(store))
