import {
	createSkillFilesController,
	type OpenedSkillFile,
	type SkillFilesController,
} from "./skill-files-controller"

import { createQueue } from "../queue"
import { createStore } from "../store"
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

	const enqueue = createQueue()

	const set = (fields: Partial<SkillsState>) => {
		stateStore.setState({ ...stateStore.getState(), ...fields })
	}

	const applyTo = (botId: string, skills: BotSkill[]) => {
		if (stateStore.getState().botId === botId) {
			set({ skills })
		}
	}

	const read = async (botId: string) =>
		applyTo(botId, await store.botSkills(botId))

	const reload = () => {
		const botId = stateStore.getState().botId
		if (botId) {
			void enqueue(() => read(botId)).catch(() => undefined)
		}
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: stateStore
				.getState()
				.skills.map((skill) =>
					skill.id === skillId ? { ...skill, ...fields } : skill,
				),
		})

	const onOpenBot = (run: (botId: string) => Promise<void>) => {
		const botId = stateStore.getState().botId
		if (botId) {
			void enqueue(() => run(botId)).catch(reload)
		}
	}

	const openBot = () => stateStore.getState().botId ?? ""

	const files = createSkillFilesController(
		{
			read: (skillId, path) => store.botSkillFile(openBot(), skillId, path),
			write: (skillId, path, text) =>
				store.writeBotSkillFile(openBot(), skillId, path, text),
			remove: (skillId, path) =>
				store.deleteBotSkillFile(openBot(), skillId, path),
		},
		{
			run: (task) => onOpenBot(() => task()),
			getFile: () => stateStore.getState().file,
			setFile: (file) => set({ file }),
			getSkills: () => stateStore.getState().skills,
			applySkill,
		},
	)

	return {
		...files,
		getState: stateStore.getState,

		subscribe: stateStore.subscribe,

		open: (botId: string) => {
			set({ botId, skills: [], file: null })
			return enqueue(() => read(botId)).catch(() => undefined)
		},

		reload,

		create: (draft: BotSkillDraft, isPreloaded: boolean) =>
			onOpenBot(async (botId) => {
				const created = await store.createBotSkill(botId, draft)
				const skill = isPreloaded
					? await store.setBotSkillPreloaded(botId, created.id, true)
					: created
				applyTo(botId, [...stateStore.getState().skills, skill])
			}),

		save: (skillId: string, draft: BotSkillDraft) =>
			onOpenBot(async (botId) => {
				const saved = await store.updateBotSkill(botId, skillId, draft)
				applySkill(skillId, saved)
				files.carryFile(skillId, saved.id)
			}),

		setPreloaded: (skillId: string, isPreloaded: boolean) => {
			applySkill(skillId, { isPreloaded })
			onOpenBot(async (botId) =>
				applySkill(
					skillId,
					await store.setBotSkillPreloaded(botId, skillId, isPreloaded),
				),
			)
		},

		remove: (skillId: string) =>
			onOpenBot(async (botId) => {
				await store.deleteBotSkill(botId, skillId)
				applyTo(
					botId,
					stateStore.getState().skills.filter((skill) => skill.id !== skillId),
				)
			}),
	}
}
