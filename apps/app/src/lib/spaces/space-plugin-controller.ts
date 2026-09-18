import { createQueue } from "../queue"
import { createStore } from "../store"
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
import { spacePlugin } from "../conversations/plugin-scope"
import type {
	BotHistoryEntry,
	BotSkill,
	BotSkillDraft,
} from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type SpacePluginState = HistoryFilesState & {
	spaceId: string | null
	skills: BotSkill[]
	commits: BotHistoryEntry[]
	hasFailedToLoad: boolean
	file: OpenedSkillFile | null
}

export type SpacePluginController = SkillFilesController & {
	getState: () => SpacePluginState
	subscribe: (listener: () => void) => () => void
	open: (spaceId: string) => Promise<void>
	reload: () => void
	createSkill: (draft: BotSkillDraft, isPreloaded: boolean) => void
	saveSkill: (skillId: string, draft: BotSkillDraft) => void
	setSkillPreloaded: (skillId: string, isPreloaded: boolean) => void
	removeSkill: (skillId: string) => void
	openFiles: (oldestCommitId: string, newestCommitId: string) => void
	revert: (oldestCommitId: string, newestCommitId: string) => void
}

export const initialSpacePluginState: SpacePluginState = {
	...initialHistoryFilesState,
	spaceId: null,
	skills: [],
	commits: [],
	hasFailedToLoad: false,
	file: null,
}

export const createSpacePluginController = (
	store: TranscriptStore,
): SpacePluginController => {
	const stateStore = createStore(initialSpacePluginState)
	const current = stateStore.getState

	const enqueue = createQueue()

	const set = (fields: Partial<SpacePluginState>) =>
		stateStore.setState({ ...current(), ...fields })

	const read = async (spaceId: string) => {
		const [skills, commits] = await Promise.all([
			store.pluginSkills(spacePlugin(spaceId)),
			store.pluginHistory(spacePlugin(spaceId)),
		])
		set({ spaceId, skills, commits, hasFailedToLoad: false })
	}

	const noteFailedRead = () => set({ hasFailedToLoad: true })

	const reload = () => {
		const spaceId = current().spaceId
		if (!spaceId) {
			return
		}
		void enqueue(() => read(spaceId)).catch(noteFailedRead)
	}

	const run = (task: (spaceId: string) => Promise<void>) => {
		const spaceId = current().spaceId
		if (!spaceId) {
			return
		}
		void enqueue(() => task(spaceId)).catch(reload)
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: current().skills.map((skill) =>
				skill.id === skillId ? { ...skill, ...fields } : skill,
			),
		})

	const readHistory = async (spaceId: string) =>
		set({
			commits: await store.pluginHistory(spacePlugin(spaceId)),
			hasFailedToLoad: false,
		})

	const openSpace = () => current().spaceId ?? ""

	const readFiles = createHistoryFilesReader(
		(oldestCommitId, newestCommitId) =>
			store.pluginHistoryDiff(
				spacePlugin(openSpace()),
				oldestCommitId,
				newestCommitId,
			),
		{
			run: (task) => run(() => task()),
			getState: current,
			setState: set,
		},
	)

	const files = createSkillFilesController(
		{
			read: (skillId, path) =>
				store.pluginSkillFile(spacePlugin(openSpace()), skillId, path),
			write: (skillId, path, text) =>
				store.writePluginSkillFile(
					spacePlugin(openSpace()),
					skillId,
					path,
					text,
				),
			remove: (skillId, path) =>
				store.deletePluginSkillFile(spacePlugin(openSpace()), skillId, path),
		},
		{
			run: (task) => run(() => task()),
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

		open: (spaceId: string) =>
			enqueue(() => read(spaceId)).catch(noteFailedRead),

		reload,

		createSkill: (draft: BotSkillDraft, isPreloaded: boolean) =>
			run(async (spaceId) => {
				const created = await store.createPluginSkill(
					spacePlugin(spaceId),
					draft,
				)
				const skill = isPreloaded
					? await store.setPluginSkillPreloaded(
							spacePlugin(spaceId),
							created.id,
							true,
						)
					: created
				set({ skills: [...current().skills, skill] })
				await readHistory(spaceId)
			}),

		saveSkill: (skillId: string, draft: BotSkillDraft) =>
			run(async (spaceId) => {
				const saved = await store.updatePluginSkill(
					spacePlugin(spaceId),
					skillId,
					draft,
				)
				applySkill(skillId, saved)
				files.carryFile(skillId, saved.id)
				await readHistory(spaceId)
			}),

		setSkillPreloaded: (skillId: string, isPreloaded: boolean) => {
			applySkill(skillId, { isPreloaded })
			run(async (spaceId) => {
				applySkill(
					skillId,
					await store.setPluginSkillPreloaded(
						spacePlugin(spaceId),
						skillId,
						isPreloaded,
					),
				)
				await readHistory(spaceId)
			})
		},

		removeSkill: (skillId: string) =>
			run(async (spaceId) => {
				await store.deletePluginSkill(spacePlugin(spaceId), skillId)
				set({
					skills: current().skills.filter((skill) => skill.id !== skillId),
				})
				await readHistory(spaceId)
			}),

		openFiles: (oldestCommitId: string, newestCommitId: string) => {
			if (current().spaceId) {
				readFiles(oldestCommitId, newestCommitId)
			}
		},

		revert: (oldestCommitId: string, newestCommitId: string) =>
			run(async (spaceId) => {
				set({
					commits: await store.revertPlugin(
						spacePlugin(spaceId),
						oldestCommitId,
						newestCommitId,
					),
				})
				set({
					skills: await store.pluginSkills(spacePlugin(spaceId)),
				})
			}),
	}
}
