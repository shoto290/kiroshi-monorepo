import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import { DotLatticeAvatar } from "@workspace/ui/components/dot-lattice-avatar"

const meta = preview.meta({
	title: "Branding/DotLatticeAvatar",
	component: DotLatticeAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"Dot lattice: a mirrored dot mask on a 7 by 7 lattice, cut from one of six outlines (circle, diamond, square, hex, cross, triangle) and carved by a seeded pattern. SVG circles; state moves as opacity across the lattice. Every parameter comes from a hash of the companion name and its tint.",
			},
		},
	},
})

export const Roster = meta.story({
	render: () => <ExplorationRoster Avatar={DotLatticeAvatar} />,
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
