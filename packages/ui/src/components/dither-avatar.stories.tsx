import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import { DitherAvatar } from "@workspace/ui/components/dither-avatar"

const meta = preview.meta({
	title: "Branding/DitherAvatar",
	component: DitherAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"Dither: a lit solid (sphere, torus, cube, capsule, cone, cylinder, octahedron, dome) shaded on a 16 by 16 grid and thresholded through a 4 by 4 Bayer matrix. Light on eight compass steps at two heights, two scales and an optional rim are the variant. Canvas 2D, scaled with pixelated rendering. Every parameter comes from a hash of the companion name and its tint.",
			},
		},
	},
})

export const Roster = meta.story({
	render: () => <ExplorationRoster Avatar={DitherAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"Six companions at 40 px, Lyra and Orion sharing the blue tint, and Lyra again at 16, 40 and 96 px. `mixed` puts Orion, Atlas and Sirius in thinking, searching and writing while the rest idle; any other choice switches all six. Check that the two blue companions part by shape alone, that the 16 px one still reads, and that each state reads still under reduced motion.",
			},
		},
	},
	play: playExplorationRoster,
})
