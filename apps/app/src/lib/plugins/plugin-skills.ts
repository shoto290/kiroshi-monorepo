import type { BotSkillDraft as EditedSkill } from "@workspace/ui/components/bot-settings"

import type { Plugin } from "./use-plugin"

import { toSkillDraft, toSkillFiles, toSkillItem } from "../bots/skill-draft"

export const toPluginSkills = ({ state, controller }: Plugin) => ({
	skills: state.skills.map(toSkillItem),
	skillFiles: toSkillFiles(state.skills, state.file, controller),
	onSkillChange: (id: string, draft: EditedSkill) =>
		controller.saveSkill(
			id,
			toSkillDraft(
				draft,
				state.skills.find((skill) => skill.id === id),
			),
		),
	onSkillCreate: (draft: EditedSkill, isPreloaded: boolean) =>
		controller.createSkill(toSkillDraft(draft), isPreloaded),
	onSkillDelete: controller.removeSkill,
	onSkillPreloadedChange: controller.setSkillPreloaded,
})
