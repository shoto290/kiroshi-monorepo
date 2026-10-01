"use client"

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import ForceGraph2D, {
	type LinkObject,
	type NodeObject,
} from "react-force-graph-2d"
import { useTranslation } from "react-i18next"

import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import {
	BLOT_TINTS,
	type BotAvatarBlot,
} from "@workspace/ui/components/companion-colour"
import { SILHOUETTE_FOCUS_RING } from "@workspace/ui/components/companion-picture"
import {
	applyLayout,
	drawsCircles,
	type GraphLayout,
	type GraphMethods,
	GUIDE_RINGS,
	nestedCircles,
	pinBots,
	type SpaceGraphDirection,
} from "@workspace/ui/components/space-graph-layout"
import {
	type GraphLink,
	type GraphNode,
	neighbourIdsOf,
	type SpaceGraphData,
	toGraph,
} from "@workspace/ui/components/space-graph-model"
import { Button } from "@workspace/ui/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const DIRECTIONS: SpaceGraphDirection[] = [
	"force",
	"hubs",
	"rings",
	"nested",
	"orbits",
]

const HIT_RADIUS_PX = 12
const HALO_SPREAD = 2.2
const HALO_PEAK_ALPHA = 0.55
const LINK_ALPHA = 0.45
const GUIDE_ALPHA = 0.25
const CIRCLE_FILL_ALPHA = 0.08
const WORKING_RING_GAP_PX = 4
const SETTLE_TICKS = 300
const MOVING_COOLDOWN_MS = 4000
const FIT_MS = 400
const FIT_PADDING = 48
const MAX_ZOOM = 3

type Palette = {
	neutral: string
	ink: string
	halo: string
	blots: Record<BotAvatarBlot, string>
}

type Tip = {
	node: GraphNode
	x: number
	y: number
	size: number
	isOpen: boolean
}

type ElementSize = { width: number; height: number }

type SpaceGraphProps = {
	graph: SpaceGraphData
	defaultDirection?: SpaceGraphDirection
}

const readPalette = (element: HTMLElement): Palette => {
	const style = getComputedStyle(element)
	const token = (name: string) => style.getPropertyValue(name).trim()
	return {
		neutral: token("--muted-foreground"),
		ink: token("--foreground"),
		halo: token("--primary"),
		blots: Object.fromEntries(
			BLOT_TINTS.map((blot) => [blot, token(`--bot-blot-${blot}`)]),
		) as Record<BotAvatarBlot, string>,
	}
}

const fillOf = (node: GraphNode, palette: Palette) =>
	node.owner ? palette.blots[node.owner.blot] : palette.neutral

const strokeCircle = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
) => {
	context.beginPath()
	context.arc(x, y, radius, 0, 2 * Math.PI)
	context.stroke()
}

const fillCircle = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
) => {
	context.beginPath()
	context.arc(x, y, radius, 0, 2 * Math.PI)
	context.fill()
}

const paintHalo = (
	node: GraphNode,
	context: CanvasRenderingContext2D,
	palette: Palette,
) => {
	if (node.freshness <= 0) return
	const x = node.x ?? 0
	const y = node.y ?? 0
	const outer = node.radius * HALO_SPREAD
	const glow = context.createRadialGradient(x, y, node.radius, x, y, outer)
	glow.addColorStop(0, palette.halo)
	glow.addColorStop(1, "transparent")
	context.save()
	context.globalAlpha = node.freshness * HALO_PEAK_ALPHA
	context.fillStyle = glow
	fillCircle(context, x, y, outer)
	context.restore()
}

const paintNode = (
	node: GraphNode,
	context: CanvasRenderingContext2D,
	scale: number,
	palette: Palette,
) => {
	const x = node.x ?? 0
	const y = node.y ?? 0
	if (node.bot) {
		if (!node.bot.isWorking) return
		context.lineWidth = 2 / scale
		context.strokeStyle = palette.ink
		strokeCircle(context, x, y, node.radius + WORKING_RING_GAP_PX / scale)
		return
	}
	paintHalo(node, context, palette)
	context.fillStyle = fillOf(node, palette)
	fillCircle(context, x, y, node.radius)
	context.lineWidth = 1 / scale
	context.strokeStyle = palette.neutral
	strokeCircle(context, x, y, node.radius)
}

const paintGuides = (
	context: CanvasRenderingContext2D,
	scale: number,
	palette: Palette,
	radii: number[],
) => {
	context.save()
	context.globalAlpha = GUIDE_ALPHA
	context.strokeStyle = palette.neutral
	context.lineWidth = 1 / scale
	context.setLineDash([4 / scale, 4 / scale])
	for (const radius of radii) {
		strokeCircle(context, 0, 0, radius)
	}
	context.restore()
}

const paintCircles = (
	context: CanvasRenderingContext2D,
	scale: number,
	palette: Palette,
	nodes: GraphNode[],
	circles: Map<string, number>,
) => {
	for (const node of nodes) {
		if (!node.bot) continue
		const radius = circles.get(node.id) ?? 0
		const colour = palette.blots[node.bot.blot]
		const x = node.x ?? 0
		const y = node.y ?? 0
		context.save()
		context.globalAlpha = CIRCLE_FILL_ALPHA
		context.fillStyle = colour
		fillCircle(context, x, y, radius)
		context.restore()
		context.lineWidth = 1.5 / scale
		context.strokeStyle = colour
		strokeCircle(context, x, y, radius)
	}
}

const useElementSize = () => {
	const element = useRef<HTMLDivElement | null>(null)
	const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
	const measure = useCallback((target: HTMLDivElement | null) => {
		element.current = target
		if (!target) return
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return
			setSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			})
		})
		observer.observe(target)
		return () => observer.disconnect()
	}, [])
	return { element, measure, size }
}

const SpaceGraph = ({
	graph: data,
	defaultDirection = "force",
}: SpaceGraphProps) => {
	const { t } = useTranslation("common")
	const prefersReducedMotion = usePrefersReducedMotion()
	const [direction, setDirection] =
		useState<SpaceGraphDirection>(defaultDirection)
	const [focusedBotId, setFocusedBotId] = useState<string>()
	const [tip, setTip] = useState<Tip>()
	const [zoom, setZoom] = useState(1)
	const { element, measure, size } = useElementSize()
	const graphRef = useRef<GraphMethods>(undefined)
	const palette = useRef<Palette>(undefined)
	const avatars = useRef(new Map<string, HTMLElement>())
	const needsFit = useRef(true)

	const whole = useMemo(() => toGraph(data), [data])
	const shownIds = focusedBotId
		? neighbourIdsOf(whole, focusedBotId)
		: undefined
	const isShown = (node: GraphNode) => !shownIds || shownIds.has(node.id)
	const layout = useMemo<GraphLayout>(
		() => ({
			direction,
			botIds: data.bots.map((bot) => bot.id),
			circles: nestedCircles(whole.nodes),
		}),
		[direction, data, whole],
	)
	const shownBots = whole.nodes.filter((node) => node.bot && isShown(node))

	useLayoutEffect(() => {
		const graph = graphRef.current
		if (!graph) return
		applyLayout(graph, whole, layout)
		needsFit.current = true
		if (!prefersReducedMotion) graph.d3ReheatSimulation()
	}, [whole, layout, prefersReducedMotion])

	const showTip = (node: GraphNode) => {
		const graph = graphRef.current
		if (!graph) return
		const point = graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0)
		setTip({
			node,
			x: point.x,
			y: point.y,
			size: node.radius * 2 * graph.zoom(),
			isOpen: true,
		})
	}

	const hideTip = () =>
		setTip((current) => current && { ...current, isOpen: false })

	const fitTo = (ids?: Set<string>) =>
		graphRef.current?.zoomToFit(
			prefersReducedMotion ? 0 : FIT_MS,
			FIT_PADDING,
			(node) => !ids || ids.has(node.id),
		)

	const focusBot = (node: GraphNode) => {
		if (!node.bot) return
		hideTip()
		setFocusedBotId(node.id)
		fitTo(neighbourIdsOf(whole, node.id))
	}

	const showWhole = () => {
		setFocusedBotId(undefined)
		fitTo()
	}

	const paintFrameBefore = (
		context: CanvasRenderingContext2D,
		scale: number,
	) => {
		if (!element.current) return
		const current = readPalette(element.current)
		palette.current = current
		paintGuides(context, scale, current, GUIDE_RINGS[direction])
		if (drawsCircles(direction)) {
			paintCircles(context, scale, current, shownBots, layout.circles)
		}
	}

	const placeAvatars = (_: CanvasRenderingContext2D, scale: number) => {
		const graph = graphRef.current
		if (!graph) return
		if (scale !== zoom) setZoom(scale)
		for (const node of shownBots) {
			const avatar = avatars.current.get(node.id)
			if (!avatar) continue
			const point = graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0)
			avatar.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`
			avatar.style.visibility = "visible"
		}
	}

	const fitOnce = () => {
		if (!needsFit.current) return
		needsFit.current = false
		fitTo(shownIds)
	}

	const paintLink = (
		link: LinkObject<GraphNode, GraphLink>,
		context: CanvasRenderingContext2D,
		scale: number,
	) => {
		if (!palette.current) return
		if (drawsCircles(direction) && link.isOwned) return
		const source = link.source as GraphNode
		const target = link.target as GraphNode
		context.save()
		context.globalAlpha = LINK_ALPHA
		context.strokeStyle = palette.current.neutral
		context.lineWidth = 1 / scale
		context.beginPath()
		context.moveTo(source.x ?? 0, source.y ?? 0)
		context.lineTo(target.x ?? 0, target.y ?? 0)
		context.stroke()
		context.restore()
	}

	const paintHitArea = (
		node: NodeObject<GraphNode>,
		colour: string,
		context: CanvasRenderingContext2D,
		scale: number,
	) => {
		context.fillStyle = colour
		fillCircle(
			context,
			node.x ?? 0,
			node.y ?? 0,
			Math.max(node.radius, HIT_RADIUS_PX / scale),
		)
	}

	return (
		<div
			className="flex size-full min-h-0 flex-col gap-3"
			data-slot="space-graph"
		>
			<div className="flex flex-wrap items-center gap-3">
				<Tabs value={direction} onValueChange={setDirection}>
					<TabsList aria-label={t("spaceGraph.directions.label")}>
						{DIRECTIONS.map((value) => (
							<TabsTrigger key={value} value={value}>
								{t(`spaceGraph.directions.${value}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{focusedBotId ? (
					<Button onClick={showWhole} size="sm" variant="outline">
						{t("spaceGraph.showWhole")}
					</Button>
				) : null}
			</div>
			<div
				className="relative min-h-0 flex-1 overflow-hidden"
				data-slot="space-graph-canvas"
				ref={measure}
			>
				<ForceGraph2D<GraphNode, GraphLink>
					autoPauseRedraw={false}
					cooldownTicks={prefersReducedMotion ? 0 : undefined}
					cooldownTime={MOVING_COOLDOWN_MS}
					graphData={whole}
					height={size.height}
					key={prefersReducedMotion ? direction : undefined}
					linkCanvasObject={paintLink}
					linkVisibility={(link) =>
						isShown(link.source as GraphNode) &&
						isShown(link.target as GraphNode)
					}
					linkCanvasObjectMode={() => "replace"}
					maxZoom={MAX_ZOOM}
					nodeCanvasObject={(node, context, scale) => {
						if (palette.current)
							paintNode(node, context, scale, palette.current)
					}}
					nodeLabel={() => ""}
					nodeVisibility={isShown}
					nodePointerAreaPaint={paintHitArea}
					onEngineStop={fitOnce}
					onNodeClick={focusBot}
					onNodeDragEnd={() => pinBots(whole.nodes, layout)}
					onNodeHover={(node) => (node ? showTip(node) : hideTip())}
					onRenderFramePost={placeAvatars}
					onRenderFramePre={paintFrameBefore}
					ref={graphRef}
					showPointerCursor={(target) => Boolean(target?.bot)}
					warmupTicks={prefersReducedMotion ? SETTLE_TICKS : 0}
					width={size.width}
				/>
				{shownBots.map((node) => (
					<button
						aria-label={t("spaceGraph.focus", { name: node.name })}
						className={cn(
							"pointer-events-none invisible absolute top-0 left-0",
							SILHOUETTE_FOCUS_RING,
						)}
						data-slot="space-graph-bot"
						key={node.id}
						onBlur={hideTip}
						onClick={() => focusBot(node)}
						onFocus={() => showTip(node)}
						ref={(avatar) => {
							if (!avatar) return
							avatars.current.set(node.id, avatar)
							return () => {
								avatars.current.delete(node.id)
							}
						}}
						type="button"
					>
						<BotIdentityAvatar
							blot={node.bot?.blot}
							name={node.name}
							size={Math.max(1, Math.round(node.radius * 2 * zoom))}
							working={node.bot?.isWorking}
						/>
					</button>
				))}
				<Tooltip open={tip?.isOpen ?? false}>
					<TooltipTrigger
						render={
							<span
								aria-hidden="true"
								className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
								style={{
									left: tip?.x ?? 0,
									top: tip?.y ?? 0,
									width: tip?.size ?? 0,
									height: tip?.size ?? 0,
								}}
							/>
						}
					/>
					{tip ? (
						<TooltipContent
							className="flex-col items-start gap-0 motion-reduce:animate-none!"
							data-slot="space-graph-tip"
						>
							<span className="font-medium break-words">{tip.node.name}</span>
							<span className="tabular-nums">
								{t("spaceGraph.detail", {
									scope: t(`spaceGraph.scopes.${tip.node.scope}`),
									tokens: tip.node.tokens,
								})}
							</span>
						</TooltipContent>
					) : null}
				</Tooltip>
			</div>
		</div>
	)
}

export { SpaceGraph, type SpaceGraphProps }
