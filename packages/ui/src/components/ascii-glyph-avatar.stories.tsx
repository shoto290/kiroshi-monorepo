import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import { AsciiGlyphAvatar } from "@workspace/ui/components/ascii-glyph-avatar"

const meta = preview.meta({
	title: "Branding/AsciiGlyphAvatar",
	component: AsciiGlyphAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"ASCII glyph: a symmetric glyph on a 5 by 7 cell grid, each lit cell a character from a seeded density ramp. State walks the ramp, so characters permute as the motion passes. Canvas 2D text; below a 3.5 px cell the characters become solid blocks. Every parameter comes from a hash of the companion name and its tint.",
			},
		},
	},
})

export const Roster = meta.story({
	render: () => <ExplorationRoster Avatar={AsciiGlyphAvatar} />,
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
