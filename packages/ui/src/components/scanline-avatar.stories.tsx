import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import { ScanlineAvatar } from "@workspace/ui/components/scanline-avatar"

const meta = preview.meta({
	title: "Branding/ScanlineAvatar",
	component: ScanlineAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"Scanline: seven rows of dashes whose widths follow one of six profiles (vase, hourglass, drop, shield, bell, capsule). A cut row, the dash length, a centre split and a brick offset are the variant. SVG lines. Every parameter comes from a hash of the companion name and its tint.",
			},
		},
	},
})

export const Roster = meta.story({
	render: () => <ExplorationRoster Avatar={ScanlineAvatar} />,
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
