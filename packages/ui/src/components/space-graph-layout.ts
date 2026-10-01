import type {
	ForceGraphMethods,
	LinkObject,
	NodeObject,
} from "react-force-graph-2d"

import type {
	Graph,
	GraphLink,
	GraphNode,
	SpaceGraphScope,
} from "@workspace/ui/components/space-graph-model"

type GraphMethods = ForceGraphMethods<
	NodeObject<GraphNode>,
	LinkObject<GraphNode, GraphLink>
>

type GraphLayout = {
	botIds: string[]
	circles: Map<string, number>
}

type Point = { x: number; y: number }

const GAP = 3
const LINK_SLACK = 24
const RING_PULL = 1
const RING_LINK_STRENGTH = 0.15
const CHARGE = -10
const CONTAINMENT = 0.5
const CIRCLE_PACKING = 1.35
const BOT_SPACING = 40
const ORBIT_CLEARANCE = 40

type SharedScope = Exclude<SpaceGraphScope, "bot">

const SCOPE_RINGS: Record<SharedScope, number> = {
	system: 40,
	user: 120,
	space: 200,
}

const sharedScopeOf = (node: GraphNode): SharedScope | undefined => {
	if (node.owner) return undefined
	return node.scope === "bot" ? "space" : node.scope
}

const sharedRing = (node: GraphNode) => {
	const scope = sharedScopeOf(node)
	return scope && SCOPE_RINGS[scope]
}

const guideRingsOf = (nodes: GraphNode[]) => {
	const scopes = new Set(nodes.map(sharedScopeOf))
	return Object.entries(SCOPE_RINGS)
		.filter(([scope]) => scopes.has(scope as SharedScope))
		.map(([, radius]) => radius)
}

const ringPoint = (index: number, count: number, radius: number): Point => {
	const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
	return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}

const botCircles = (nodes: GraphNode[]) => {
	const areas = new Map<string, number>()
	for (const node of nodes) {
		if (!node.owner) continue
		const area = (areas.get(node.owner.id) ?? 0) + (node.radius + GAP) ** 2
		areas.set(node.owner.id, area)
	}
	return new Map(
		[...areas].map(([botId, area]) => [
			botId,
			Math.sqrt(area) * CIRCLE_PACKING,
		]),
	)
}

const spreadRing = ({ botIds, circles }: GraphLayout) => {
	const widest = Math.max(0, ...circles.values())
	if (botIds.length < 2) return 0
	return (widest + BOT_SPACING) / Math.sin(Math.PI / botIds.length)
}

const orbitRing = (layout: GraphLayout) =>
	Math.max(
		SCOPE_RINGS.space +
			ORBIT_CLEARANCE +
			Math.max(0, ...layout.circles.values()),
		spreadRing(layout),
	)

const pinBots = (nodes: GraphNode[], layout: GraphLayout) => {
	const radius = orbitRing(layout)
	for (const node of nodes) {
		if (!node.bot) continue
		const place = ringPoint(
			layout.botIds.indexOf(node.id),
			layout.botIds.length,
			radius,
		)
		node.fx = place.x
		node.fy = place.y
	}
}

const nodeForce = (apply: (nodes: GraphNode[], alpha: number) => void) => {
	let nodes: GraphNode[] = []
	const force = (alpha: number) => apply(nodes, alpha)
	force.initialize = (next: GraphNode[]) => {
		nodes = next
	}
	return force
}

const offset = (from: Point, node: GraphNode) => {
	const dx = (node.x ?? 0) - from.x
	const dy = (node.y ?? 0) - from.y
	return { dx, dy, distance: Math.hypot(dx, dy) || 1e-6 }
}

const nudge = (node: GraphNode, dx: number, dy: number) => {
	node.vx = (node.vx ?? 0) + dx
	node.vy = (node.vy ?? 0) + dy
}

const collide = () =>
	nodeForce((nodes) => {
		for (const [index, a] of nodes.entries()) {
			for (const b of nodes.slice(index + 1)) {
				const { dx, dy, distance } = offset({ x: a.x ?? 0, y: a.y ?? 0 }, b)
				const minimum = a.radius + b.radius + GAP
				if (distance >= minimum) continue
				const push = ((minimum - distance) / distance) * 0.5
				nudge(b, dx * push, dy * push)
				nudge(a, -dx * push, -dy * push)
			}
		}
	})

const scopeRings = () =>
	nodeForce((nodes, alpha) => {
		const origin = { x: 0, y: 0 }
		for (const node of nodes) {
			const ring = sharedRing(node)
			if (ring === undefined) continue
			const { dx, dy, distance } = offset(origin, node)
			const pull = ((ring - distance) / distance) * RING_PULL * alpha
			nudge(node, dx * pull, dy * pull)
		}
	})

const containInCircles = (circles: Map<string, number>) =>
	nodeForce((nodes) => {
		const centres = nodes.filter((node) => node.bot)
		for (const node of nodes) {
			if (node.bot) continue
			for (const centre of centres) {
				const circle = circles.get(centre.id) ?? 0
				const from = { x: centre.x ?? 0, y: centre.y ?? 0 }
				const { dx, dy, distance } = offset(from, node)
				const isMember = node.owner?.id === centre.id
				const excess = isMember
					? distance - (circle - node.radius - GAP)
					: circle + node.radius + GAP - distance
				if (excess <= 0) continue
				const push = (excess / distance) * CONTAINMENT * (isMember ? -1 : 1)
				nudge(node, dx * push, dy * push)
			}
		}
	})

const linkDistance = (link: GraphLink) => {
	const source = link.source as GraphNode
	const target = link.target as GraphNode
	return source.radius + target.radius + LINK_SLACK
}

const applyLayout = (
	graph: GraphMethods,
	{ nodes }: Graph,
	layout: GraphLayout,
) => {
	pinBots(nodes, layout)
	graph.d3Force("link")?.distance?.(linkDistance).strength(RING_LINK_STRENGTH)
	graph.d3Force("charge")?.strength?.(CHARGE)
	graph.d3Force("center")?.strength?.(0)
	graph.d3Force("collide", collide())
	graph.d3Force("scope-rings", scopeRings())
	graph.d3Force("circles", containInCircles(layout.circles))
}

export {
	applyLayout,
	botCircles,
	type GraphLayout,
	type GraphMethods,
	guideRingsOf,
	pinBots,
}
