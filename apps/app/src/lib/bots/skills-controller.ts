import {
	createSkillFilesController,
	type OpenedSkillFile,
	type SkillFilesController,
} from "./skill-files-controller"

import { createQueue } from "../queue"
import { createStore } from "../store"
import { botPlugin } from "../conversations/plugin-scope"
import type { BotSkill, BotSkillDraft } from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type SkillsState = {
	botId: string | null
	skills: BotSkill[]
	file: OpenedSkillFile | null
}

export type SkillsController = SkillFilesController & {
	getState: () => SkillsState
	subscribe: (listener: () => void) => () => void
	open: (botId: string) => Promise<void>
	reload: () => void
	create: (draft: BotSkillDraft, isPreloaded: boolean) => void
	save: (skillId: string, draft: BotSkillDraft) => void
	setPreloaded: (skillId: string, isPreloaded: boolean) => void
	remove: (skillId: string) => void
}

export const initialSkillsState: SkillsState = {
	botId: null,
	skills: [],
	file: null,
}

export const createSkillsController = (
	store: TranscriptStore,
): SkillsController => {
	const stateStore = createStore(initialSkillsState)
	const current = stateStore.getState

	const enqueue = createQueue()

	const set = (fields: Partial<SkillsState>) =>
		stateStore.setState({ ...current(), ...fields })

	const applyTo = (botId: string, skills: BotSkill[]) => {
		if (current().botId === botId) {
			set({ skills })
		}
	}

	const read = async (botId: string) =>
		applyTo(botId, await store.pluginSkills(botPlugin(botId)))

	const reload = () => {
		const botId = current().botId
		if (botId) {
			void enqueue(() => read(botId)).catch(() => undefined)
		}
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: current().skills.map((skill) =>
				skill.id === skillId ? { ...skill, ...fields } : skill,
			),
		})

	const onOpenBot = (run: (botId: string) => Promise<void>) => {
		const botId = current().botId
		if (botId) {
			void enqueue(() => run(botId)).catch(reload)
		}
	}

	const openBot = () => current().botId ?? ""

	const files = createSkillFilesController(
		{
			read: (skillId, path) =>
				store.pluginSkillFile(botPlugin(openBot()), skillId, path),
			write: (skillId, path, text) =>
				store.writePluginSkillFile(botPlugin(openBot()), skillId, path, text),
			remove: (skillId, path) =>
				store.deletePluginSkillFile(botPlugin(openBot()), skillId, path),
		},
		{
			run: (task) => onOpenBot(() => task()),
			getFile: () => current().file,
			setFile: (file) => set({ file }),
			getSkills: () => current().skills,
			applySkill,
		},
	)

	return {
		...files,
		getState: current,

		subscribe: stateStore.subscribe,

		open: (botId: string) => {
			set({ botId, skills: [], file: null })
			return enqueue(() => read(botId)).catch(() => undefined)
		},

		reload,

		create: (draft: BotSkillDraft, isPreloaded: boolean) =>
			onOpenBot(async (botId) => {
				const created = await store.createPluginSkill(botPlugin(botId), draft)
				const skill = isPreloaded
					? await store.setPluginSkillPreloaded(
							botPlugin(botId),
							created.id,
							true,
						)
					: created
				applyTo(botId, [...current().skills, skill])
			}),

		save: (skillId: string, draft: BotSkillDraft) =>
			onOpenBot(async (botId) => {
				const saved = await store.updatePluginSkill(
					botPlugin(botId),
					skillId,
					draft,
				)
				applySkill(skillId, saved)
				files.carryFile(skillId, saved.id)
			}),

		setPreloaded: (skillId: string, isPreloaded: boolean) => {
			applySkill(skillId, { isPreloaded })
			onOpenBot(async (botId) =>
				applySkill(
					skillId,
					await store.setPluginSkillPreloaded(
						botPlugin(botId),
						skillId,
						isPreloaded,
					),
				),
			)
		},

		remove: (skillId: string) =>
			onOpenBot(async (botId) => {
				await store.deletePluginSkill(botPlugin(botId), skillId)
				applyTo(
					botId,
					current().skills.filter((skill) => skill.id !== skillId),
				)
			}),
	}
}
