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
import { isSamePluginScope } from "../conversations/plugin-scope"
import type {
	BotHistoryEntry,
	BotSkill,
	BotSkillDraft,
	PluginScope,
} from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export type PluginState = HistoryFilesState & {
	scope: PluginScope | null
	skills: BotSkill[]
	commits: BotHistoryEntry[]
	hasFailedToLoad: boolean
	file: OpenedSkillFile | null
}

export type PluginController = SkillFilesController & {
	getState: () => PluginState
	subscribe: (listener: () => void) => () => void
	open: (scope: PluginScope) => Promise<void>
	reload: () => void
	createSkill: (draft: BotSkillDraft, isPreloaded: boolean) => void
	saveSkill: (skillId: string, draft: BotSkillDraft) => void
	setSkillPreloaded: (skillId: string, isPreloaded: boolean) => void
	removeSkill: (skillId: string) => void
	openFiles: (oldestCommitId: string, newestCommitId: string) => void
	revert: (oldestCommitId: string, newestCommitId: string) => void
}

export const initialPluginState: PluginState = {
	...initialHistoryFilesState,
	scope: null,
	skills: [],
	commits: [],
	hasFailedToLoad: false,
	file: null,
}

export const createPluginController = (
	store: TranscriptStore,
): PluginController => {
	const stateStore = createStore(initialPluginState)
	const current = stateStore.getState

	const enqueue = createQueue()

	const set = (fields: Partial<PluginState>) =>
		stateStore.setState({ ...current(), ...fields })

	const applyTo = (scope: PluginScope, fields: Partial<PluginState>) => {
		if (isSamePluginScope(current().scope, scope)) {
			set(fields)
		}
	}

	const read = async (scope: PluginScope) => {
		const [skills, commits] = await Promise.all([
			store.pluginSkills(scope),
			store.pluginHistory(scope),
		])
		applyTo(scope, { skills, commits, hasFailedToLoad: false })
	}

	const readCommits = async (scope: PluginScope) =>
		applyTo(scope, {
			commits: await store.pluginHistory(scope),
			hasFailedToLoad: false,
		})

	const refresh = (scope: PluginScope) =>
		enqueue(() => read(scope)).catch(() =>
			applyTo(scope, { hasFailedToLoad: true }),
		)

	const openScope = () => {
		const scope = current().scope
		if (!scope) {
			throw new Error("no plugin scope open")
		}
		return scope
	}

	const reload = () => {
		const scope = current().scope
		if (scope) {
			void refresh(scope)
		}
	}

	const onOpenScope = (run: (scope: PluginScope) => Promise<void>) => {
		const scope = current().scope
		if (scope) {
			void enqueue(() => run(scope)).catch(() => refresh(scope))
		}
	}

	const applySkill = (skillId: string, fields: Partial<BotSkill>) =>
		set({
			skills: current().skills.map((skill) =>
				skill.id === skillId ? { ...skill, ...fields } : skill,
			),
		})

	const readFilesOf = (scope: PluginScope) =>
		createHistoryFilesReader(
			(oldestCommitId, newestCommitId) =>
				store.pluginHistoryDiff(scope, oldestCommitId, newestCommitId),
			{
				run: (task) => onOpenScope(() => task()),
				getState: current,
				setState: set,
			},
		)

	const files = createSkillFilesController(
		{
			read: (skillId, path) =>
				store.pluginSkillFile(openScope(), skillId, path),
			write: (skillId, path, text) =>
				store.writePluginSkillFile(openScope(), skillId, path, text),
			remove: (skillId, path) =>
				store.deletePluginSkillFile(openScope(), skillId, path),
		},
		{
			run: (task) => onOpenScope(() => task()),
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

		open: (scope: PluginScope) => {
			set({
				...initialHistoryFilesState,
				scope,
				skills: [],
				commits: [],
				hasFailedToLoad: false,
				file: null,
			})
			return refresh(scope)
		},

		reload,

		createSkill: (draft: BotSkillDraft, isPreloaded: boolean) =>
			onOpenScope(async (scope) => {
				const created = await store.createPluginSkill(scope, draft)
				const skill = isPreloaded
					? await store.setPluginSkillPreloaded(scope, created.id, true)
					: created
				applyTo(scope, { skills: [...current().skills, skill] })
				await readCommits(scope)
			}),

		saveSkill: (skillId: string, draft: BotSkillDraft) =>
			onOpenScope(async (scope) => {
				const saved = await store.updatePluginSkill(scope, skillId, draft)
				applySkill(skillId, saved)
				files.carryFile(skillId, saved.id)
				await readCommits(scope)
			}),

		setSkillPreloaded: (skillId: string, isPreloaded: boolean) => {
			applySkill(skillId, { isPreloaded })
			onOpenScope(async (scope) => {
				applySkill(
					skillId,
					await store.setPluginSkillPreloaded(scope, skillId, isPreloaded),
				)
				await readCommits(scope)
			})
		},

		removeSkill: (skillId: string) =>
			onOpenScope(async (scope) => {
				await store.deletePluginSkill(scope, skillId)
				applyTo(scope, {
					skills: current().skills.filter((skill) => skill.id !== skillId),
				})
				await readCommits(scope)
			}),

		openFiles: (oldestCommitId: string, newestCommitId: string) => {
			const scope = current().scope
			if (scope) {
				readFilesOf(scope)(oldestCommitId, newestCommitId)
			}
		},

		revert: (oldestCommitId: string, newestCommitId: string) =>
			onOpenScope(async (scope) => {
				const commits = await store.revertPlugin(
					scope,
					oldestCommitId,
					newestCommitId,
				)
				applyTo(scope, { commits, skills: await store.pluginSkills(scope) })
			}),
	}
}
