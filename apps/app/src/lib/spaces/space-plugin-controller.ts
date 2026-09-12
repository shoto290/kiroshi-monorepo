import { createQueue } from "../queue"
import { joinedPatches } from "../bots/changed-files"
import type { BotCommit } from "../bots/history-controller"
import {
	createSkillFilesController,
	type OpenedSkillFile,
	type SkillFilesController,
} from "../bots/skill-files-controller"
import type { BotSkill, BotSkillDraft } from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type SpacePluginState = {
	spaceId: string | null
	skills: BotSkill[]
	commits: BotCommit[]
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
	loadDiff: (oldestCommitId: string, newestCommitId: string) => void
	revert: (oldestCommitId: string, newestCommitId: string) => void
}

export const initialSpacePluginState: SpacePluginState = {
	spaceId: null,
	skills: [],
	commits: [],
	file: null,
}

export const createSpacePluginController = (
	store: TranscriptStore,
): SpacePluginController => {
	let state = initialSpacePluginState
	const listeners = new Set<() => void>()

	const enqueue = createQueue()

	const set = (fields: Partial<SpacePluginState>) => {
		state = { ...state, ...fields }
		for (const listener of listeners) {
			listener()
		}
	}

	const read = async (spaceId: string) => {
		const [skills, commits] = await Promise.all([
			store.spacePluginSkills(spaceId),
			store.spacePluginHistory(spaceId),
		])
		set({ spaceId, skills, commits })
	}

	const reload = () => {
		const spaceId = state.spaceId
		if (!spaceId) {
			return
		}
		void enqueue(() => read(spaceId)).catch(() => undefined)
	}

	const run = (task: (spaceId: string) => Promise<void>) => {
		const spaceId = state.spaceId
		if (!spaceId) {
			return
		}
		void enqueue(() => task(spaceId)).catch(reload)
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: state.skills.map((skill) =>
				skill.id === skillId ? { ...skill, ...fields } : skill,
			),
		})

	const readHistory = async (spaceId: string) =>
		set({ commits: await store.spacePluginHistory(spaceId) })

	const openSpace = () => state.spaceId ?? ""

	const files = createSkillFilesController(
		{
			read: (skillId, path) =>
				store.spacePluginSkillFile(openSpace(), skillId, path),
			write: (skillId, path, text) =>
				store.writeSpacePluginSkillFile(openSpace(), skillId, path, text),
			remove: (skillId, path) =>
				store.deleteSpacePluginSkillFile(openSpace(), skillId, path),
		},
		{
			run: (task) => run(() => task()),
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

		open: (spaceId: string) =>
			enqueue(() => read(spaceId)).catch(() => undefined),

		reload,

		createSkill: (draft: BotSkillDraft, isPreloaded: boolean) =>
			run(async (spaceId) => {
				const created = await store.createSpacePluginSkill(spaceId, draft)
				const skill = isPreloaded
					? await store.setSpacePluginSkillPreloaded(spaceId, created.id, true)
					: created
				set({ skills: [...state.skills, skill] })
				await readHistory(spaceId)
			}),

		saveSkill: (skillId: string, draft: BotSkillDraft) =>
			run(async (spaceId) => {
				const saved = await store.updateSpacePluginSkill(
					spaceId,
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
					await store.setSpacePluginSkillPreloaded(
						spaceId,
						skillId,
						isPreloaded,
					),
				)
				await readHistory(spaceId)
			})
		},

		removeSkill: (skillId: string) =>
			run(async (spaceId) => {
				await store.deleteSpacePluginSkill(spaceId, skillId)
				set({ skills: state.skills.filter((skill) => skill.id !== skillId) })
				await readHistory(spaceId)
			}),

		loadDiff: (oldestCommitId: string, newestCommitId: string) => {
			const known = state.commits.find((commit) => commit.id === newestCommitId)
			if (known?.diff !== undefined) {
				return
			}
			run(async (spaceId) => {
				const diff = joinedPatches(
					await store.spacePluginHistoryDiff(
						spaceId,
						oldestCommitId,
						newestCommitId,
					),
				)
				set({
					commits: state.commits.map((commit) =>
						commit.id === newestCommitId ? { ...commit, diff } : commit,
					),
				})
			})
		},

		revert: (oldestCommitId: string, newestCommitId: string) =>
			run(async (spaceId) => {
				set({
					commits: await store.revertSpacePlugin(
						spaceId,
						oldestCommitId,
						newestCommitId,
					),
				})
				set({ skills: await store.spacePluginSkills(spaceId) })
			}),
	}
}
