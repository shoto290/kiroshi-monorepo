import type { BotAvatarBlot } from "@workspace/ui/components/companion-colour"

type SpaceGraphScope = "system" | "user" | "space" | "bot"

type SpaceGraphPluginKind = "skill" | "application" | "file"

type SpaceGraphBot = {
	id: string
	name: string
	blot?: BotAvatarBlot
	isWorking: boolean
}

type SpaceGraphPlugin = {
	id: string
	name: string
	kind: SpaceGraphPluginKind
	scope: SpaceGraphScope
	tokens: number
	lastWriteAt: string
	loadedBy: string[]
}

type SpaceGraphData = {
	space: { id: string; name: string }
	observedAt: string
	bots: SpaceGraphBot[]
	plugins: SpaceGraphPlugin[]
}

type GraphNode = {
	id: string
	name: string
	scope: SpaceGraphScope
	tokens: number
	radius: number
	freshness: number
	owner?: SpaceGraphBot
	bot?: SpaceGraphBot
	x?: number
	y?: number
	vx?: number
	vy?: number
	fx?: number
	fy?: number
}

type GraphLink = {
	source: string | GraphNode
	target: string | GraphNode
	isOwned: boolean
}

type Graph = { nodes: GraphNode[]; links: GraphLink[] }

const HOUR_MS = 3_600_000
const FRESH_MS = 24 * HOUR_MS
const STALE_MS = 7 * 24 * HOUR_MS
const TOKENS_PER_UNIT_AREA = 40
const MIN_RADIUS = 3

const radiusFor = (tokens: number) =>
	Math.max(MIN_RADIUS, Math.sqrt(tokens / TOKENS_PER_UNIT_AREA))

const freshnessOf = (lastWriteAt: string, observedAt: string) => {
	const age = Date.parse(observedAt) - Date.parse(lastWriteAt)
	if (age <= FRESH_MS) return 1
	if (age >= STALE_MS) return 0
	return 1 - (age - FRESH_MS) / (STALE_MS - FRESH_MS)
}

const linkEnd = (end: string | GraphNode) =>
	typeof end === "string" ? end : end.id

const toGraph = (data: SpaceGraphData): Graph => {
	const botsById = new Map(data.bots.map((bot) => [bot.id, bot]))
	const loadedTokens = (bot: SpaceGraphBot) =>
		data.plugins
			.filter((plugin) => plugin.loadedBy.includes(bot.id))
			.reduce((sum, plugin) => sum + plugin.tokens, 0)

	const botNodes = data.bots.map((bot): GraphNode => {
		const tokens = loadedTokens(bot)
		return {
			id: bot.id,
			name: bot.name,
			scope: "bot",
			tokens,
			radius: radiusFor(tokens),
			freshness: 0,
			owner: bot,
			bot,
		}
	})

	const pluginNodes = data.plugins.map(
		(plugin): GraphNode => ({
			id: plugin.id,
			name: plugin.name,
			scope: plugin.scope,
			tokens: plugin.tokens,
			radius: radiusFor(plugin.tokens),
			freshness: freshnessOf(plugin.lastWriteAt, data.observedAt),
			owner:
				plugin.loadedBy.length === 1
					? botsById.get(plugin.loadedBy[0])
					: undefined,
		}),
	)

	const links = data.plugins.flatMap((plugin) =>
		plugin.loadedBy.map(
			(botId): GraphLink => ({
				source: botId,
				target: plugin.id,
				isOwned: plugin.loadedBy.length === 1,
			}),
		),
	)

	return { nodes: [...botNodes, ...pluginNodes], links }
}

const neighbourIdsOf = (graph: Graph, botId: string) =>
	new Set([
		botId,
		...graph.links
			.filter((link) => linkEnd(link.source) === botId)
			.map((link) => linkEnd(link.target)),
	])

export {
	freshnessOf,
	type Graph,
	type GraphLink,
	type GraphNode,
	linkEnd,
	neighbourIdsOf,
	type SpaceGraphData,
	type SpaceGraphScope,
	toGraph,
}
