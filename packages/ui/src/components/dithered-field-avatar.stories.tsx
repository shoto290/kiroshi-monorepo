import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import type { ExplorationAvatarProps } from "@workspace/ui/components/avatar-exploration"
import {
	DitheredFieldAvatar,
	type DitherScreen,
} from "@workspace/ui/components/dithered-field-avatar"

const screenAvatar = (screen: DitherScreen) => {
	const ScreenAvatar = (props: ExplorationAvatarProps) => (
		<DitheredFieldAvatar {...props} screen={screen} />
	)
	return ScreenAvatar
}

const WeightRampAvatar = screenAvatar("weight")
const HalftoneAvatar = screenAvatar("halftone")
const OrderedAvatar = screenAvatar("ordered")
const OrganicAvatar = screenAvatar("organic")

const meta = preview.meta({
	title: "Branding/DitheredFieldAvatar",
	component: DitheredFieldAvatar,
	tags: ["test"],
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"A companion drawn as a dithered field that fills the whole rounded tile: white ink on a saturated field of the companion's hue, no outline, the shape carried by density alone. The density field is the companion's ASCII glyph silhouette, blurred, over a seeded low noise floor; the hue is the chosen colour's hue pushed to a saturated field and nudged by the seed. At 40 px the screen reads as texture and the identity comes from the macro shape of the field and its hue. At work the field drifts and the state motion passes through it; at rest, and under reduced motion, it holds still.",
			},
		},
	},
})

export const WeightRamp = meta.story({
	render: () => <ExplorationRoster Avatar={WeightRampAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"Each cell picks its glyph from a ramp of increasing ink weight by the field density: a dot, a small square, a cross, a filled square. Check that the six silhouettes part at 40 px and that the 16 px one still shows its mass.",
			},
		},
	},
	play: playExplorationRoster,
})

export const Halftone = meta.story({
	render: () => <ExplorationRoster Avatar={HalftoneAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"One dot per cell, its radius following the field density. Check that the silhouettes part at 40 px by where the dots swell, and that the 16 px one reads as a soft blob of the right shape.",
			},
		},
	},
	play: playExplorationRoster,
})

export const TwoToneOrdered = meta.story({
	render: () => <ExplorationRoster Avatar={OrderedAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"The density thresholded through a 4 by 4 Bayer matrix into one square glyph, on or off. Check that the crosshatch of the Bayer pattern stays even and that the silhouettes part at 40 px.",
			},
		},
	},
	play: playExplorationRoster,
})

export const ThreeToneOrganic = meta.story({
	render: () => <ExplorationRoster Avatar={OrganicAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"White ink plus a lighter tint of the hue on the field, through Floyd-Steinberg error diffusion over three tones. Check that the grain looks organic rather than gridded and that the silhouettes part at 40 px.",
			},
		},
	},
	play: playExplorationRoster,
})
