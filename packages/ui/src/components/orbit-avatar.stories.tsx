import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import { OrbitAvatar } from "@workspace/ui/components/orbit-avatar"

const meta = preview.meta({
	title: "Branding/OrbitAvatar",
	component: OrbitAvatar,
	tags: ["test-only"],
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"Orbit: a core with one to three tilted orbits of satellites, or a ring and a moon. The layout is the family; tilt, satellite count, flattening and core size are the variant. SVG; satellites travel their orbit while busy. Every parameter comes from a hash of the companion name and its tint.",
			},
		},
	},
})

export const Roster = meta.story({
	render: () => <ExplorationRoster Avatar={OrbitAvatar} />,
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
