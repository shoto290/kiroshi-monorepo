import type { ComponentProps, ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { BLOT_TINTS, BotAvatar } from "@workspace/ui/components/bot-avatar"
import {
	ANIMALS,
	type BotAvatarAnimal,
} from "@workspace/ui/components/bot-avatar-animals"
import {
	type BotAvatarState,
	STATE_GROUPS,
	STATE_POOLS,
} from "@workspace/ui/components/bot-avatar-data"
import { GAZE_CADENCE } from "@workspace/ui/components/bot-avatar-gaze"

const BOT_AVATAR_ANIMALS = Object.keys(ANIMALS) as BotAvatarAnimal[]
const BOT_AVATAR_STATES = Object.keys(STATE_POOLS) as BotAvatarState[]
const HERO_SIZE = 240
const BLOT_SEEDS = [
	"bot-1",
	"bot-2",
	"bot-7",
	"bot-8",
	"bot-5",
	"bot-6",
	"bot-3",
	"bot-4",
]
const STRESS_COUNT = 60
const TURN_ANIMALS: BotAvatarAnimal[] = ["rabbit", "cat", "owl"]
const TURN_STATE: BotAvatarState = "working"
const CHIP_SIZE = 40
const GLANCE_STATES = Object.keys(GAZE_CADENCE) as BotAvatarState[]
const GLANCE_SIZES = [HERO_SIZE, CHIP_SIZE]

const GROUPED_STATES = Object.entries(STATE_GROUPS).flatMap(([group, states]) =>
	states.map((state) => ({ group, state })),
)

const STATE_OPTIONS = [
	...GROUPED_STATES.map((entry) => entry.state),
	...BOT_AVATAR_STATES.filter(
		(state) => !GROUPED_STATES.some((entry) => entry.state === state),
	),
]

const STATE_LABELS = Object.fromEntries(
	STATE_OPTIONS.map((state) => [
		state,
		`${GROUPED_STATES.find((entry) => entry.state === state)?.group ?? "Other"} · ${state}`,
	]),
)

function LabeledCell({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
	return (
		<div className="flex flex-col items-center gap-1">
			{children}
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	)
}

type StateGridProps = ComponentProps<typeof BotAvatar>

const StateGrid = (avatar: StateGridProps) => (
	<div className="flex flex-col gap-8">
		{Object.entries(STATE_GROUPS).map(([group, states]) => (
			<div key={group}>
				<h3 className="mb-3 font-medium text-muted-foreground text-sm">
					{group}
				</h3>
				<div className="grid grid-cols-7 gap-4">
					{states.map((state) => (
						<LabeledCell key={state} label={state}>
							<BotAvatar {...avatar} state={state} />
						</LabeledCell>
					))}
				</div>
			</div>
		))}
	</div>
)

const meta = preview.meta({
	title: "Branding/Companion Avatar",
	component: BotAvatar,
	parameters: { layout: "centered" },
	args: {
		animal: "rabbit",
		state: "waiting",
		size: HERO_SIZE,
		animated: true,
		perspective: 0.55,
		ink: "bold",
	},
	argTypes: {
		animal: { control: "select", options: BOT_AVATAR_ANIMALS },
		state: {
			control: "select",
			options: STATE_OPTIONS,
			labels: STATE_LABELS,
		},
		size: { control: { type: "range", min: 48, max: 480, step: 8 } },
		perspective: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
		ink: {
			control: "inline-radio",
			options: ["regular", "bold", "heavy"],
		},
		blot: { control: "select", options: [undefined, ...BLOT_TINTS] },
		seed: { control: "text" },
		animated: { control: "boolean" },
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this to audition any animal in any engine state with live animation. Check that eyes, ears and head move as one group, that the head keeps breathing with about a degree of ambient drift, and that the sketch line only boils on active states.",
			},
		},
	},
})

export const AllStates = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Every engine state running live, side by side and grouped as in the engine's lifecycle tables. Reach for this to compare expressions, ear poses and cadences at a glance — States covers the same matrix as frozen poses when you need a stable reference.",
			},
		},
	},
	render: (args) => <StateGrid {...args} size={96} />,
})

export const Stress = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Sixty live avatars on one shared animation clock — every mounted engine subscribes to a single requestAnimationFrame loop rather than opening its own. Reach for this before shipping the avatar into a list or a transcript: scroll and watch for dropped frames, then flip `wireframe` on to see the per-frame geometry cost.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-10 gap-1">
			{Array.from({ length: STRESS_COUNT }, (_, index) => (
				<BotAvatar
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed length stress grid
					key={index}
					{...args}
					animal={BOT_AVATAR_ANIMALS[index % BOT_AVATAR_ANIMALS.length]}
					size={64}
					state={BOT_AVATAR_STATES[index % BOT_AVATAR_STATES.length]}
				/>
			))}
		</div>
	),
})

export const Variants = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every available animal at rest, side by side as static poses. Reach for this when picking which animal represents a given AI. Check that each silhouette stays recognisable at a glance and that ear shapes read distinctly from the neighbours — Playground covers live motion.",
			},
		},
	},
	render: () => (
		<div className="grid grid-cols-4 gap-6">
			{BOT_AVATAR_ANIMALS.map((animal) => (
				<LabeledCell key={animal} label={animal}>
					<BotAvatar animal={animal} animated={false} size={140} />
				</LabeledCell>
			))}
		</div>
	),
})

export const States = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Every engine state rendered as a static pose, grouped as in the engine's lifecycle tables. Reach for this to verify a state's expression and ear pose without waiting for random cadences — AllStates covers the same matrix live.",
			},
		},
	},
	render: () => <StateGrid animated={false} size={88} />,
})

export const Blots = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The eight tints a companion can be marked with, drawn once behind the whole animal, plus the avatar with no blot at all. The names are the ones an agent file's `color` key reads, so a tint survives the round trip to a companion's bundle unchanged. Seven of the eight inks came through the renaming untouched — `purple` is the lavender it always was. `orange` is the one that was drawn again: it inherited a grey, and a reader picking Orange is owed an orange, here and in the agent display that reads the same word. It sits between `red` and `yellow` now. The blot sits outside the sketch filter, so it never boils with the line and never animates — the ink is what moves, the mark is what stays. All eight are light on purpose: the line is near-black and the ear accent is coral, and neither reads over anything darker. Reach for this when adding a tint, and check on both themes — the tints do not flip under `.dark`, so a companion's mark is the same colour wherever it is shown. The first cell is the markup the avatar renders without a blot and must be untouched by any of this. Pick `BlotShapes` for the shapes one tint is laid down in.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-3 gap-6">
			<LabeledCell label="none">
				<BotAvatar {...args} animated={false} blot={undefined} size={120} />
			</LabeledCell>
			{BLOT_TINTS.map((blot) => (
				<LabeledCell key={blot} label={blot}>
					<BotAvatar {...args} animated={false} blot={blot} size={120} />
				</LabeledCell>
			))}
		</div>
	),
})

export const BlotShapes = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Eight companions on one tint and one animal, told apart by nothing but their id. The blot is the one authored outline in all eight — the seed only decides which quarter turn it is laid down at and whether it is mirrored, so the silhouette a reader learns is never redrawn and never warped. These ids cover all eight poses, and the first is the pose the outline was authored in, which is what an avatar with no seed draws. Reach for this when the ink or the outline changes: check that every pose still fills the same square, that none of them clips the animal or the edge of the box, and that the tint is identical across the row. Pick `Blots` for the eight tints on one shape.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-4 gap-6">
			{BLOT_SEEDS.map((seed) => (
				<LabeledCell key={seed} label={seed}>
					<BotAvatar
						{...args}
						animated={false}
						blot="blue"
						seed={seed}
						size={120}
					/>
				</LabeledCell>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const shapes = slotsIn(canvasElement, "bot-avatar-blot").map((blot) =>
			blot.getAttribute("transform"),
		)

		await expect(new Set(shapes).size).toBe(BLOT_SEEDS.length)
	},
})

export const Sizes = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"The same avatar from chip to hero size, as static poses. The ink is authored in rendered pixels, so the outline holds a marker weight at 40px instead of thinning to a hairline, and the sketch displacement is retuned against it. Reach for this when embedding the avatar in a new surface: check the four sizes read as the same pen and that nothing clips at small sizes.",
			},
		},
	},
	render: () => (
		<div className="flex items-end gap-6">
			{[40, 88, 140, 240].map((size) => (
				<LabeledCell key={size} label={`${size}px`}>
					<BotAvatar animated={false} size={size} />
				</LabeledCell>
			))}
		</div>
	),
})

export const Glances = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"The five states that glance, each at hero size and at chip size, running live. The eyes dart to a new target in 80 ms with no easing, hold it for at least 420 ms, and the head only starts leaning 90 ms later at under half the angle — the eyes lead, the head follows. Each state has its own rhythm: searching scans fastest and flattest, working looks down at six tenths of the amplitude, writing keeps a narrow downward gaze, waiting returns to centre between two glances, thinking sweeps the whole ellipse. Reach for this when retuning a cadence: check that the 40px companion still reads as looking somewhere rather than smearing, and that no glance ever pulls an eye off the head.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-8">
			{GLANCE_STATES.map((state) => (
				<div className="flex items-center gap-6" key={state}>
					{GLANCE_SIZES.map((size) => (
						<LabeledCell key={size} label={`${state} · ${size}px`}>
							<BotAvatar {...args} size={size} state={state} />
						</LabeledCell>
					))}
				</div>
			))}
		</div>
	),
})

export const HeadTurn = meta.story({
	tags: ["test-only"],
	name: "Head Turn",
	parameters: {
		docs: {
			description: {
				story:
					"Three animals at hero size, working, turning on their own gaze. Everything on the head moves at the depth it sits at: the eyes ride the surface, the extras a little behind them, the blush closer to the middle of the skull, so a turn slides them by different amounts instead of scaling one flat drawing. The ears arrive last. They aim at the head as it stood 70 ms earlier, drag against the turn, overshoot once and settle after the head has stopped, and the ear nearest the viewer travels further than the one going away. Reach for this after retuning the lag, the drag or a depth ratio, and open it in Storybook for the movement: the test browser forces reduced motion, which freezes each avatar on one static frame.",
			},
		},
	},
	render: (args) => (
		<div className="flex items-end gap-6">
			{TURN_ANIMALS.map((animal) => (
				<LabeledCell key={animal} label={animal}>
					<BotAvatar
						{...args}
						animal={animal}
						size={HERO_SIZE}
						state={TURN_STATE}
					/>
				</LabeledCell>
			))}
		</div>
	),
})

export const ChipRow = meta.story({
	tags: ["test-only"],
	name: "Chip Row",
	parameters: {
		docs: {
			description: {
				story:
					"Every animal in a row at 40px, the smallest slot the product draws, each one live. Amplitudes are authored in viewBox units and degrees and quantised to a fraction of a rendered pixel, so a chip holds still instead of shivering while the head breathes and the ears sway. Reach for this whenever an amplitude changes: watch a full minute and check that no avatar jitters, and that the ears still read as ears at this size.",
			},
		},
	},
	render: (args) => (
		<div className="flex items-center gap-2">
			{BOT_AVATAR_ANIMALS.map((animal) => (
				<BotAvatar {...args} animal={animal} key={animal} size={CHIP_SIZE} />
			))}
		</div>
	),
})

const inkOf = (avatar: SVGSVGElement) => {
	const eye = avatar.querySelector('[data-part="eye-0"]')
	const outline = avatar.querySelector('[data-part="head"] path')
	if (!eye || !outline) throw new Error("This avatar draws no eye or outline")
	return {
		eye: getComputedStyle(eye).fill,
		outline: getComputedStyle(outline).stroke,
	}
}

const surfaceBehind = (avatar: SVGSVGElement) => {
	const blot = avatar.querySelector('[data-slot="bot-avatar-blot"]')
	if (blot) return getComputedStyle(blot).fill
	for (
		let node: Element | null = avatar.parentElement;
		node;
		node = node.parentElement
	) {
		const { backgroundColor } = getComputedStyle(node)
		if (backgroundColor !== "rgba(0, 0, 0, 0)") return backgroundColor
	}
	throw new Error("Nothing paints a surface behind this avatar")
}

export const InkDark = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The avatar under the dark theme, bare and on a blot. Check that the eyes take the same ink as the outline in both cells: near-white on the dark surface without a blot, near-black on the tint with one. An eye that follows the text colour instead vanishes on any light ground.",
			},
		},
	},
	render: (args) => (
		<div className="flex gap-6">
			<BotAvatar {...args} animated={false} blot={undefined} />
			<BotAvatar {...args} animated={false} blot="yellow" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const avatars = Array.from(canvasElement.querySelectorAll("svg[role=img]"))

		await expect(avatars).toHaveLength(2)
		for (const avatar of avatars as SVGSVGElement[]) {
			const ink = inkOf(avatar)
			await expect(ink.eye).toBe(ink.outline)
			await expect(ink.eye).not.toBe(surfaceBehind(avatar))
		}
	},
})
