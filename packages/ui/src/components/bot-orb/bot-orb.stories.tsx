import { type BotAvatarType, botAvatarShapes } from "bot-avatars"
import type { ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	expectInkContrast,
	Row,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { BLOT_TINTS } from "@workspace/ui/components/bot-avatar"
import {
	BOT_ORB_STATES,
	BotOrb,
	type BotOrbProps,
} from "@workspace/ui/components/bot-orb"
import type { OrbState } from "@workspace/ui/components/bot-orb/types"
import { BotTile, SHAPE_SCALE } from "@workspace/ui/components/bot-tile"
import { TILE_ROSTER_IDS } from "@workspace/ui/components/bots.fixtures"

const NAME = "Atlas"
const SEED = "bot-atlas"
const SHIPPED_SIZE = 20
const MAX_PREVIEW_SIZE = 160
const MAX_PIXEL_RATIO = 2
const SHAPE_DESIGN_UNITS = 100
const EDGE_TOLERANCE_PIXELS = 2

type StoryCanvas = { canvasElement: HTMLElement; args: BotOrbProps }

type LabeledCellProps = { label: string; children: ReactNode }

const LabeledCell = ({ label, children }: LabeledCellProps) => (
	<div className="flex flex-col items-center gap-1">
		{children}
		<span className="text-muted-foreground text-xs">{label}</span>
	</div>
)

const backingPixelRatio = () =>
	Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1)

const asksForStillness = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

const orbsIn = (canvasElement: HTMLElement) => slotsIn(canvasElement, "bot-orb")

const dotsOf = (orb: HTMLElement) => {
	const dots = orb.querySelector("canvas")
	if (!dots) throw new Error("The orb has no canvas to read")
	return dots
}

const paintedPixelsOf = (orb: HTMLElement) => {
	const dots = dotsOf(orb)
	const copy = document.createElement("canvas")
	copy.width = dots.width
	copy.height = dots.height
	const context = copy.getContext("2d", { willReadFrequently: true })
	if (!context) throw new Error("2D canvas context unavailable")
	context.drawImage(dots, 0, 0)
	const { data } = context.getImageData(0, 0, dots.width, dots.height)
	return Array.from({ length: dots.width * dots.height }, (_, index) => ({
		x: index % dots.width,
		y: Math.floor(index / dots.width),
	})).filter((_, index) => data[index * 4 + 3] !== 0)
}

const pixelsOutsideShape = (orb: HTMLElement) => {
	const dots = dotsOf(orb)
	const probe = document.createElement("canvas").getContext("2d")
	if (!probe) throw new Error("2D canvas context unavailable")
	const scale = (dots.width * SHAPE_SCALE) / SHAPE_DESIGN_UNITS
	const inset = (dots.width * (1 - SHAPE_SCALE)) / 2
	probe.setTransform(scale, 0, 0, scale, inset, inset)
	probe.lineWidth = (EDGE_TOLERANCE_PIXELS * 2) / scale
	const silhouette = new Path2D(
		botAvatarShapes[orb.dataset.shape as BotAvatarType],
	)
	return paintedPixelsOf(orb).filter(
		({ x, y }) =>
			!probe.isPointInPath(silhouette, x + 0.5, y + 0.5) &&
			!probe.isPointInStroke(silhouette, x + 0.5, y + 0.5),
	)
}

const expectOrbsRender = async (
	{ canvasElement, args }: StoryCanvas,
	count: number,
) => {
	const orbs = orbsIn(canvasElement)
	await expect(orbs).toHaveLength(count)
	for (const orb of orbs) {
		await expect(orb).toHaveAccessibleName()
		await expect(orb.style.width).toBe(`${args.size}px`)
		await expect(dotsOf(orb).width).toBe(
			Math.round((args.size ?? SHIPPED_SIZE) * backingPixelRatio()),
		)
		await expect(paintedPixelsOf(orb).length).toBeGreaterThan(0)
		await expect(pixelsOutsideShape(orb)).toHaveLength(0)
	}
}

const stateStory = (state: OrbState) => ({
	args: { state },
	parameters: {
		docs: {
			description: {
				story: `The upstream \`${state}\` animation, its dots clipped to the bot's seeded shape on its tinted tile. It animates while the state is set and holds one still frame under reduced motion, which is what the test run emulates.`,
			},
		},
	},
	play: async ({ canvasElement, args }: StoryCanvas) => {
		await expectOrbsRender({ canvasElement, args }, 1)
		const [orb] = orbsIn(canvasElement)
		await expect(orb?.dataset.state).toBe(state)
		await expect(orb?.dataset.animated).toBe(String(!asksForStillness()))
		await expect(orb?.getAttribute("aria-label")).toContain(NAME)
	},
})

const themeStory = (theme: "light" | "dark") => ({
	globals: { theme },
	parameters: {
		docs: {
			description: {
				story: `The eight blots on the ${theme} theme. Each tile is tinted from its blot and its dots take the same blot; light darkens the dots toward the ink through \`--bot-orb-shade\`, dark keeps the pastel, so the dots clear 3:1 against their own tile.`,
			},
		},
	},
	render: (args: BotOrbProps) => (
		<Row>
			{BLOT_TINTS.map((blot) => (
				<LabeledCell key={blot} label={blot}>
					<BotOrb {...args} blot={blot} state="working" />
				</LabeledCell>
			))}
		</Row>
	),
	play: async ({ canvasElement, args }: StoryCanvas) => {
		await expectOrbsRender({ canvasElement, args }, BLOT_TINTS.length)
		for (const orb of orbsIn(canvasElement)) {
			await expectInkContrast({
				ink: getComputedStyle(dotsOf(orb)).color,
				surface: getComputedStyle(orb).backgroundColor,
			})
		}
	},
})

const meta = preview.meta({
	title: "Branding/BotOrb",
	component: BotOrb,
	parameters: { layout: "centered" },
	args: { seed: SEED, name: NAME, size: SHIPPED_SIZE },
	argTypes: {
		seed: { control: "text" },
		name: { control: "text" },
		blot: { control: "select", options: [undefined, ...BLOT_TINTS] },
		state: { control: "select", options: [undefined, ...BOT_ORB_STATES] },
		size: {
			control: {
				type: "range",
				min: SHIPPED_SIZE,
				max: MAX_PREVIEW_SIZE,
				step: 4,
			},
		},
	},
})

export const Rest = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The orb with no state: one still frame of dots inside the seeded shape, on the tile BotTile tints for the same seed. Pick a state in the controls to animate it. Drag `size` to magnify the 20px design without changing it; 20 is the shipped size.",
			},
		},
	},
	play: async ({ canvasElement, args }) => {
		await expectOrbsRender({ canvasElement, args }, 1)
		const [orb] = orbsIn(canvasElement)
		await expect(orb?.dataset.animated).toBe("false")
		await expect(orb?.getAttribute("aria-label")).toBe(NAME)
	},
})

export const Working = meta.story(stateStory("working"))
export const Searching = meta.story(stateStory("searching"))
export const Solving = meta.story(stateStory("solving"))
export const Listening = meta.story(stateStory("listening"))
export const Connecting = meta.story(stateStory("connecting"))
export const Weaving = meta.story(stateStory("weaving"))
export const Composing = meta.story(stateStory("composing"))
export const Breathing = meta.story(stateStory("breathing"))
export const Shaping = meta.story(stateStory("shaping"))

export const ReducedMotion = meta.story({
	args: { state: "working" },
	parameters: {
		docs: {
			description: {
				story:
					"A working orb under `prefers-reduced-motion`: it paints one still frame, dots inside the shape, and never starts its loop. The test run emulates the preference; turn it on in the OS to see it here.",
			},
		},
	},
	play: async ({ canvasElement, args }) => {
		await expectOrbsRender({ canvasElement, args }, 1)
		await expect(orbsIn(canvasElement)[0]?.dataset.animated).toBe(
			String(!asksForStillness()),
		)
	},
})

export const Light = meta.story(themeStory("light"))
export const Dark = meta.story(themeStory("dark"))

export const SeededGallery = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Twelve bots seeded from their ids alone, each BotTile beside its BotOrb at the same size, 20px as shipped. One seed gives both marks the same tint and the same shape.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-4 gap-6">
			{TILE_ROSTER_IDS.map((seed) => (
				<LabeledCell key={seed} label={seed}>
					<Row>
						<BotTile seed={seed} size={args.size} variant="tinted" />
						<BotOrb {...args} seed={seed} name={seed} />
					</Row>
				</LabeledCell>
			))}
		</div>
	),
	play: async ({ canvasElement, args }) => {
		await expectOrbsRender({ canvasElement, args }, TILE_ROSTER_IDS.length)
		const tiles = slotsIn(canvasElement, "bot-tile")
		const orbs = orbsIn(canvasElement)
		for (const [index, tile] of tiles.entries()) {
			const orb = orbs[index]
			await expect(orb?.style.getPropertyValue("--bot-tile-blot")).toBe(
				tile.style.getPropertyValue("--bot-tile-blot"),
			)
			await expect(orb?.dataset.shape).toBe(
				tile.querySelector("canvas")?.dataset.botAvatar,
			)
		}
	},
})
