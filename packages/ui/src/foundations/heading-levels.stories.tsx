import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { expectFont } from "@workspace/storybook/story-utils"
import { HeadingLevels } from "@workspace/ui/foundations/type-scale"

const meta = preview.meta({
	title: "Foundations/Heading Levels",
	tags: ["test-only", "!autodocs"],
	render: () => <HeadingLevels />,
})

export const HeadingFontOnTheTopTwoLevelsOnly = meta.story({
	play: async ({ canvas }) => {
		const headings = canvas.getAllByRole("heading")
		await expect(headings.map(({ tagName }) => tagName)).toEqual([
			"H1",
			"H2",
			"H3",
			"H4",
			"H5",
			"H6",
		])
		for (const heading of headings) {
			await expectFont(
				heading,
				["H1", "H2"].includes(heading.tagName) ? "font-heading" : "font-sans",
			)
		}
	},
})
