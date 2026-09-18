import { createQueue } from "../queue"
import {
	createHistoryFilesReader,
	type HistoryFilesState,
	initialHistoryFilesState,
} from "../bots/history-files-controller"
import {
	createSkillFilesController,
	type OpenedSkillFile,
	type SkillFilesController,
} from "../bots/skill-files-controller"
import { USER_PLUGIN } from "../conversations/plugin-scope"
import type {
	BotHistoryEntry,
	BotSkill,
	BotSkillDraft,
} from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type UserPluginState = HistoryFilesState & {
	skills: BotSkill[]
	commits: BotHistoryEntry[]
	hasFailedToLoad: boolean
	file: OpenedSkillFile | null
}

export type UserPluginController = SkillFilesController & {
	getState: () => UserPluginState
	subscribe: (listener: () => void) => () => void
	open: () => Promise<void>
	reload: () => void
	createSkill: (draft: BotSkillDraft, isPreloaded: boolean) => void
	saveSkill: (skillId: string, draft: BotSkillDraft) => void
	setSkillPreloaded: (skillId: string, isPreloaded: boolean) => void
	removeSkill: (skillId: string) => void
	openFiles: (oldestCommitId: string, newestCommitId: string) => void
	revert: (oldestCommitId: string, newestCommitId: string) => void
}

export const initialUserPluginState: UserPluginState = {
	...initialHistoryFilesState,
	skills: [],
	commits: [],
	hasFailedToLoad: false,
	file: null,
}

export const createUserPluginController = (
	store: TranscriptStore,
): UserPluginController => {
	let state = initialUserPluginState
	const listeners = new Set<() => void>()

	const enqueue = createQueue()

	const set = (fields: Partial<UserPluginState>) => {
		state = { ...state, ...fields }
		for (const listener of listeners) {
			listener()
		}
	}

	const read = async () => {
		const [skills, commits] = await Promise.all([
			store.pluginSkills(USER_PLUGIN),
			store.pluginHistory(USER_PLUGIN),
		])
		set({ skills, commits, hasFailedToLoad: false })
	}

	const noteFailedRead = () => set({ hasFailedToLoad: true })

	const reload = () => {
		void enqueue(read).catch(noteFailedRead)
	}

	const run = (task: () => Promise<void>) => {
		void enqueue(task).catch(reload)
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: state.skills.map((skill) =>
				skill.id === skillId ? { ...skill, ...fields } : skill,
			),
		})

	const readHistory = async () =>
		set({
			commits: await store.pluginHistory(USER_PLUGIN),
			hasFailedToLoad: false,
		})

	const readFiles = createHistoryFilesReader(
		(oldestCommitId, newestCommitId) =>
			store.pluginHistoryDiff(USER_PLUGIN, oldestCommitId, newestCommitId),
		{ run, getState: () => state, setState: set },
	)

	const files = createSkillFilesController(
		{
			read: (skillId, path) =>
				store.pluginSkillFile(USER_PLUGIN, skillId, path),
			write: (skillId, path, text) =>
				store.writePluginSkillFile(USER_PLUGIN, skillId, path, text),
			remove: (skillId, path) =>
				store.deletePluginSkillFile(USER_PLUGIN, skillId, path),
		},
		{
			run,
			getFile: () => state.file,
			setFile: (file) => set({ file }),
			getSkills: () => state.skills,
			applySkill,
		},
	)

	return {
		...files,
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: () => enqueue(read).catch(noteFailedRead),

		reload,

		createSkill: (draft: BotSkillDraft, isPreloaded: boolean) =>
			run(async () => {
				const created = await store.createPluginSkill(USER_PLUGIN, draft)
				const skill = isPreloaded
					? await store.setPluginSkillPreloaded(USER_PLUGIN, created.id, true)
					: created
				set({ skills: [...state.skills, skill] })
				await readHistory()
			}),

		saveSkill: (skillId: string, draft: BotSkillDraft) =>
			run(async () => {
				const saved = await store.updatePluginSkill(USER_PLUGIN, skillId, draft)
				applySkill(skillId, saved)
				files.carryFile(skillId, saved.id)
				await readHistory()
			}),

		setSkillPreloaded: (skillId: string, isPreloaded: boolean) => {
			applySkill(skillId, { isPreloaded })
			run(async () => {
				applySkill(
					skillId,
					await store.setPluginSkillPreloaded(
						USER_PLUGIN,
						skillId,
						isPreloaded,
					),
				)
				await readHistory()
			})
		},

		removeSkill: (skillId: string) =>
			run(async () => {
				await store.deletePluginSkill(USER_PLUGIN, skillId)
				set({ skills: state.skills.filter((skill) => skill.id !== skillId) })
				await readHistory()
			}),

		openFiles: readFiles,

		revert: (oldestCommitId: string, newestCommitId: string) =>
			run(async () => {
				set({
					commits: await store.revertPlugin(
						USER_PLUGIN,
						oldestCommitId,
						newestCommitId,
					),
				})
				set({ skills: await store.pluginSkills(USER_PLUGIN) })
			}),
	}
}
