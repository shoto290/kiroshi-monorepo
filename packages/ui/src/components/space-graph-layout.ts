import type {
	ForceGraphMethods,
	LinkObject,
	NodeObject,
} from "react-force-graph-2d"

import {
	type Graph,
	type GraphLink,
	type GraphNode,
	linkEnd,
	type SpaceGraphScope,
} from "@workspace/ui/components/space-graph-model"

type SpaceGraphDirection = "force" | "hubs" | "rings" | "nested"

type GraphMethods = ForceGraphMethods<
	NodeObject<GraphNode>,
	LinkObject<GraphNode, GraphLink>
>

type GraphLayout = {
	direction: SpaceGraphDirection
	botIds: string[]
	circles: Map<string, number>
}

type Point = { x: number; y: number }

const GAP = 3
const LINK_SLACK = 24
const HUB_RING = 180
const CENTRE_PULL = 0.08
const RING_PULL = 1
const RING_LINK_STRENGTH = 0.15
const CONTAINMENT = 0.5
const CIRCLE_PACKING = 1.35
const NESTED_SPACING = 40

const SCOPE_RINGS: Record<SpaceGraphScope, number> = {
	system: 40,
	user: 120,
	space: 200,
	bot: 290,
}

const BOT_EDGE_RING = 370

const CHARGE: Record<SpaceGraphDirection, number> = {
	force: -90,
	hubs: -60,
	rings: -20,
	nested: -10,
}

const ringPoint = (index: number, count: number, radius: number): Point => {
	const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
	return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}

const nestedCircles = (nodes: GraphNode[]) => {
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

const nestedRing = ({ botIds, circles }: GraphLayout) => {
	const widest = Math.max(0, ...circles.values())
	if (botIds.length < 2) return 0
	return (widest + NESTED_SPACING) / Math.sin(Math.PI / botIds.length)
}

const botRingRadius = (layout: GraphLayout) => {
	if (layout.direction === "hubs") return HUB_RING
	if (layout.direction === "rings") return BOT_EDGE_RING
	if (layout.direction === "nested") return nestedRing(layout)
	return undefined
}

const pinBots = (nodes: GraphNode[], layout: GraphLayout) => {
	const radius = botRingRadius(layout)
	for (const node of nodes) {
		if (!node.bot) continue
		const place =
			radius === undefined
				? undefined
				: ringPoint(
						layout.botIds.indexOf(node.id),
						layout.botIds.length,
						radius,
					)
		node.fx = place?.x
		node.fy = place?.y
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

const pullSharedToCentre = () =>
	nodeForce((nodes, alpha) => {
		for (const node of nodes) {
			if (node.owner) continue
			const pull = CENTRE_PULL * alpha
			nudge(node, -(node.x ?? 0) * pull, -(node.y ?? 0) * pull)
		}
	})

const scopeRings = () =>
	nodeForce((nodes, alpha) => {
		const origin = { x: 0, y: 0 }
		for (const node of nodes) {
			const { dx, dy, distance } = offset(origin, node)
			const pull =
				((SCOPE_RINGS[node.scope] - distance) / distance) * RING_PULL * alpha
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

const degreeStrength = (links: GraphLink[]) => {
	const degrees = new Map<string, number>()
	for (const id of links.flatMap((link) => [
		linkEnd(link.source),
		linkEnd(link.target),
	])) {
		degrees.set(id, (degrees.get(id) ?? 0) + 1)
	}
	return (link: GraphLink) =>
		1 /
		Math.min(
			degrees.get(linkEnd(link.source)) ?? 1,
			degrees.get(linkEnd(link.target)) ?? 1,
		)
}

const applyLayout = (
	graph: GraphMethods,
	{ nodes, links }: Graph,
	layout: GraphLayout,
) => {
	const { direction } = layout
	pinBots(nodes, layout)
	graph
		.d3Force("link")
		?.distance?.(linkDistance)
		.strength(
			direction === "rings" ? RING_LINK_STRENGTH : degreeStrength(links),
		)
	graph.d3Force("charge")?.strength?.(CHARGE[direction])
	graph.d3Force("center")?.strength?.(direction === "force" ? 1 : 0)
	graph.d3Force("collide", direction === "force" ? null : collide())
	graph.d3Force(
		"centre-pull",
		direction === "hubs" || direction === "nested"
			? pullSharedToCentre()
			: null,
	)
	graph.d3Force("scope-rings", direction === "rings" ? scopeRings() : null)
	graph.d3Force(
		"circles",
		direction === "nested" ? containInCircles(layout.circles) : null,
	)
}

export {
	applyLayout,
	BOT_EDGE_RING,
	type GraphLayout,
	type GraphMethods,
	nestedCircles,
	pinBots,
	SCOPE_RINGS,
	type SpaceGraphDirection,
}
