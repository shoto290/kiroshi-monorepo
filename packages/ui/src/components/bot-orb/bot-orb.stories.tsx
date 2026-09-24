import type { ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	expectInkContrast,
	Row,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { BLOT_TINTS, blotTint } from "@workspace/ui/components/bot-avatar"
import {
	BOT_ORB_SIZES,
	BOT_ORB_STATES,
	BotOrb,
	type BotOrbProps,
} from "@workspace/ui/components/bot-orb"
import type { OrbState } from "@workspace/ui/components/bot-orb/types"
import { BotTile, seededBlot } from "@workspace/ui/components/bot-tile"
import { TILE_ROSTER_IDS } from "@workspace/ui/components/bots.fixtures"

const NAME = "Atlas"
const SEED = "bot-atlas"

type StoryCanvas = { canvasElement: HTMLElement }

type LabeledCellProps = { label: string; children: ReactNode }

const LabeledCell = ({ label, children }: LabeledCellProps) => (
	<div className="flex flex-col items-center gap-1">
		{children}
		<span className="text-muted-foreground text-xs">{label}</span>
	</div>
)

const asksForStillness = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

const orbsIn = (canvasElement: HTMLElement) => slotsIn(canvasElement, "bot-orb")

const paintedPixels = (orb: HTMLElement) => {
	if (!(orb instanceof HTMLCanvasElement)) return 0
	const context = orb.getContext("2d")
	if (!context) return 0
	const { data } = context.getImageData(0, 0, orb.width, orb.height)
	return data.filter((_, index) => index % 4 === 3 && data[index] !== 0).length
}

const expectOrbsRender = async (canvasElement: HTMLElement, count: number) => {
	const orbs = orbsIn(canvasElement)
	await expect(orbs).toHaveLength(count)
	for (const orb of orbs) {
		await expect(orb).toHaveAccessibleName()
		await expect(paintedPixels(orb)).toBeGreaterThan(0)
	}
}

const stateStory = (state: OrbState) => ({
	args: { state },
	parameters: {
		docs: {
			description: {
				story: `The upstream \`${state}\` design at 64px, tinted with the bot's blot. It animates while the state is set, and holds a still frame under reduced motion, which is what the test run emulates.`,
			},
		},
	},
	play: async ({ canvasElement }: StoryCanvas) => {
		await expectOrbsRender(canvasElement, 1)
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
				story: `The eight blots as orb tints on the ${theme} background. Light darkens each pastel toward the ink through \`--bot-orb-shade\` so the dots clear 3:1 against the page; dark keeps the pastel as it is.`,
			},
		},
	},
	render: (args: BotOrbProps) => (
		<div data-slot="orb-surface" className="bg-background p-4">
			<Row>
				{BLOT_TINTS.map((blot) => (
					<LabeledCell key={blot} label={blot}>
						<BotOrb {...args} blot={blot} state="working" />
					</LabeledCell>
				))}
			</Row>
		</div>
	),
	play: async ({ canvasElement }: StoryCanvas) => {
		await expectOrbsRender(canvasElement, BLOT_TINTS.length)
		const [surface] = slotsIn(canvasElement, "orb-surface")
		if (!surface) throw new Error("The orb surface is missing")
		for (const orb of orbsIn(canvasElement)) {
			await expectInkContrast({
				ink: getComputedStyle(orb).color,
				surface: getComputedStyle(surface).backgroundColor,
			})
		}
	},
})

const meta = preview.meta({
	title: "Branding/BotOrb",
	component: BotOrb,
	parameters: { layout: "centered" },
	args: { seed: SEED, name: NAME },
	argTypes: {
		seed: { control: "text" },
		name: { control: "text" },
		blot: { control: "select", options: [undefined, ...BLOT_TINTS] },
		state: { control: "select", options: [undefined, ...BOT_ORB_STATES] },
		size: { control: "inline-radio", options: BOT_ORB_SIZES },
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Audition one orb. With no state it rests on a still frame; pick a state to animate it. With no blot the tint comes from the seed, the same one BotTile picks.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectOrbsRender(canvasElement, 1)
		await expect(orbsIn(canvasElement)[0]?.dataset.animated).toBe("false")
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

export const Size64 = meta.story({
	args: { size: 64, state: "working" },
	parameters: {
		docs: {
			description: {
				story:
					"The chat-avatar design: its own dot count, dot size and speed, tuned upstream.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectOrbsRender(canvasElement, 1)
		await expect(orbsIn(canvasElement)[0]?.style.width).toBe("64px")
	},
})

export const Size20 = meta.story({
	args: { size: 20, state: "working" },
	parameters: {
		docs: {
			description: {
				story:
					"The inline-text design: fewer, larger dots at a faster pace, tuned upstream rather than scaled down from 64.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectOrbsRender(canvasElement, 1)
		await expect(orbsIn(canvasElement)[0]?.style.width).toBe("20px")
	},
})

export const Light = meta.story(themeStory("light"))
export const Dark = meta.story(themeStory("dark"))

export const ReducedMotion = meta.story({
	args: { state: "working" },
	parameters: {
		docs: {
			description: {
				story:
					"A working orb under `prefers-reduced-motion`: it paints one still frame and never starts its loop. The test run emulates the preference; turn it on in the OS to see it here.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectOrbsRender(canvasElement, 1)
		await expect(orbsIn(canvasElement)[0]?.dataset.animated).toBe(
			String(!asksForStillness()),
		)
	},
})

export const SeededGallery = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Twelve bots seeded from their ids alone, each BotTile beside its BotOrb. The orb takes the blot the tile picks for the same seed, so a bot keeps one colour across both marks.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-4 gap-6">
			{TILE_ROSTER_IDS.map((seed) => (
				<LabeledCell key={seed} label={seed}>
					<Row>
						<BotTile seed={seed} size={64} />
						<BotOrb {...args} seed={seed} name={seed} />
					</Row>
				</LabeledCell>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expectOrbsRender(canvasElement, TILE_ROSTER_IDS.length)
		const tiles = slotsIn(canvasElement, "bot-tile")
		const orbs = orbsIn(canvasElement)
		for (const [index, seed] of TILE_ROSTER_IDS.entries()) {
			const tint = blotTint(seededBlot(seed))
			await expect(
				tiles[index]?.style.getPropertyValue("--bot-tile-blot"),
			).toBe(tint)
			await expect(orbs[index]?.style.color).toContain(tint)
		}
	},
})
