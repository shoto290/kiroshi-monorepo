import type { SpaceGraphData } from "@workspace/ui/components/space-graph-model"
import type {
	SpaceGraphFailure,
	SpaceGraphScreenState,
} from "@workspace/ui/components/space-graph-screen"

import type {
	Bot,
	BotHistoryEntry,
	BotMcpServer,
	BotSkill,
	PluginScope,
} from "../conversations/store-contract"
import type { TranscriptStore } from "../conversations/store-port"

export const APPROXIMATE_CHARS_PER_TOKEN = 4

export type SpaceGraphStore = Pick<
	TranscriptStore,
	| "bots"
	| "pluginSkills"
	| "pluginSkillFile"
	| "pluginMcpServers"
	| "pluginHistory"
>

export type ReadSpaceGraph = Exclude<
	SpaceGraphScreenState,
	{ status: "loading" }
>

type SpaceGraphPlugin = SpaceGraphData["plugins"][number]

type SizedSkill = { skill: BotSkill; tokens: number }

type BotPlugin = {
	bot: Bot
	skills: SizedSkill[]
	servers: BotMcpServer[]
	commits: BotHistoryEntry[]
}

type BotRead =
	| { plugin: BotPlugin; failures: [] }
	| { plugin?: undefined; failures: SpaceGraphFailure[] }

const SECOND_MS = 1000

const NEVER_WRITTEN = 0

const estimateTokens = (text: string) =>
	Math.ceil(text.length / APPROXIMATE_CHARS_PER_TOKEN)

const isoOf = (timestamp: number) =>
	new Date(timestamp * SECOND_MS).toISOString()

const newestOf = (commits: BotHistoryEntry[]) =>
	Math.max(NEVER_WRITTEN, ...commits.map((commit) => commit.timestamp))

const touchesFolder = (commit: BotHistoryEntry, folder: string) =>
	commit.paths.some((path) => path.startsWith(folder))

const lastSkillWrite = (skill: BotSkill, commits: BotHistoryEntry[]) => {
	const folder = `skills/${skill.id}/`
	const touching = commits.filter((commit) => touchesFolder(commit, folder))
	return newestOf(touching.length > 0 ? touching : commits)
}

const sizedSkills = async (
	store: SpaceGraphStore,
	scope: PluginScope,
): Promise<SizedSkill[]> => {
	const skills = await store.pluginSkills(scope)
	return Promise.all(
		skills.map(async (skill) => {
			const files = await Promise.all(
				skill.files.map((path) => store.pluginSkillFile(scope, skill.id, path)),
			)
			return { skill, tokens: estimateTokens(skill.body + files.join("")) }
		}),
	)
}

const readBot = async (store: SpaceGraphStore, bot: Bot): Promise<BotRead> => {
	const scope: PluginScope = { kind: "bot", id: bot.id }
	const [skills, servers, commits] = await Promise.allSettled([
		sizedSkills(store, scope),
		store.pluginMcpServers(scope),
		store.pluginHistory(scope),
	])
	if (
		skills.status === "fulfilled" &&
		servers.status === "fulfilled" &&
		commits.status === "fulfilled"
	) {
		return {
			plugin: {
				bot,
				skills: skills.value,
				servers: servers.value,
				commits: commits.value,
			},
			failures: [],
		}
	}
	const reads = [
		["skills", skills],
		["applications", servers],
		["history", commits],
	] as const
	return {
		failures: reads
			.filter(([, read]) => read.status === "rejected")
			.map(([read]) => ({ read, botName: bot.name })),
	}
}

const pluginNodesOf = ({
	bot,
	skills,
	servers,
	commits,
}: BotPlugin): SpaceGraphPlugin[] => [
	...skills.map(({ skill, tokens }) => ({
		id: `${bot.id}:skill:${skill.id}`,
		name: skill.name,
		kind: "skill" as const,
		scope: "bot" as const,
		tokens,
		lastWriteAt: isoOf(lastSkillWrite(skill, commits)),
		loadedBy: [bot.id],
	})),
	...servers.map((server) => ({
		id: `${bot.id}:application:${server.name}`,
		name: server.title ?? server.name,
		kind: "application" as const,
		scope: "bot" as const,
		tokens: estimateTokens(JSON.stringify(server.config)),
		lastWriteAt: isoOf(newestOf(commits)),
		loadedBy: [bot.id],
	})),
]

export const readSpaceGraph = async (
	store: SpaceGraphStore,
	space: { id: string; name: string },
	observedAt: Date,
): Promise<ReadSpaceGraph> => {
	const [bots] = await Promise.allSettled([store.bots(space.id)])
	if (bots.status === "rejected") {
		return { status: "failed", failures: [{ read: "bots" }] }
	}
	const reads = await Promise.all(bots.value.map((bot) => readBot(store, bot)))
	const failures = reads.flatMap((read) => read.failures)
	if (failures.length > 0) {
		return { status: "failed", failures }
	}
	return {
		status: "ready",
		graph: {
			space,
			observedAt: observedAt.toISOString(),
			bots: bots.value.map((bot) => ({
				id: bot.id,
				name: bot.name,
				blot: bot.avatarBlot ?? undefined,
				isWorking: false,
			})),
			plugins: reads.flatMap((read) =>
				read.plugin ? pluginNodesOf(read.plugin) : [],
			),
		},
	}
}
