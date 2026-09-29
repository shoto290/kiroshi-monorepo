import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { expectFont, expectHeadingFont } from "@workspace/storybook/story-utils"
import { HeadingLevels } from "@workspace/ui/foundations/type-scale"

const meta = preview.meta({
	title: "Foundations/Heading Levels",
	tags: ["test-only", "!autodocs"],
	globals: { theme_layout: "side-by-side" },
	render: () => <HeadingLevels />,
})

const TYPE_PROPERTIES = [
	"fontFamily",
	"fontWeight",
	"fontSize",
	"lineHeight",
] as const

const typeOf = (element: Element) => {
	const style = getComputedStyle(element)
	return TYPE_PROPERTIES.map((property) => style[property])
}

export const HeadingFontOnTheTopTwoLevelsOnly = meta.story({
	play: async ({ canvas }) => {
		const headings = canvas.getAllByRole("heading")
		const levels = ["H1", "H2", "H3", "H4", "H5", "H6"]
		await expect(headings.map(({ tagName }) => tagName)).toEqual([
			...levels,
			...levels,
		])
		for (const heading of headings) {
			if (["H1", "H2"].includes(heading.tagName)) {
				await expectHeadingFont(heading)
			} else {
				await expectFont(heading, "font-sans")
				await expect(getComputedStyle(heading).fontWeight).toBe("400")
			}
		}
		const light = headings.slice(0, levels.length)
		const dark = headings.slice(levels.length)
		await expect(dark.map(typeOf)).toEqual(light.map(typeOf))
	},
})
