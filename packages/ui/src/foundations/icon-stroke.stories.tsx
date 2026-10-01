import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row } from "@workspace/storybook/story-utils"
import { type Icon, Icons } from "@workspace/ui/components/icons"
import * as RegistryGlyphs from "@workspace/ui/shims/lucide-react"

const BRAND_MARKS = ["Claude", "GitHub", "Linear", "Paper", "Superset", "X"]

const KEYLINE_GLYPHS: [string, Icon][] = [
	...Object.entries(Icons).filter(([name]) => !BRAND_MARKS.includes(name)),
	...Object.entries(RegistryGlyphs),
]

const ICON_GRID_UNITS_PER_PIXEL_AT_16PX = 24 / 16

const iconStrokeIn = (host: Element) => {
	const probe = document.createElement("div")
	probe.style.width = "var(--icon-stroke)"
	host.append(probe)
	const width = Number.parseFloat(getComputedStyle(probe).width)
	probe.remove()
	return width
}

const meta = preview.meta({
	title: "Foundations/Icon Stroke",
	tags: ["test-only", "!autodocs"],
	render: () => (
		<Row>
			{KEYLINE_GLYPHS.map(([name, Glyph]) => (
				<Glyph key={name} className="size-4" data-glyph={name} />
			))}
		</Row>
	),
})

export const EveryKeylineGlyphDrawsTheIconStroke = meta.story({
	play: async ({ canvasElement }) => {
		const glyphs = Array.from(
			canvasElement.querySelectorAll<SVGSVGElement>("svg[data-glyph]"),
		)
		await expect(glyphs).toHaveLength(KEYLINE_GLYPHS.length)

		for (const glyph of glyphs) {
			const strokeWidth = Number.parseFloat(getComputedStyle(glyph).strokeWidth)
			const iconStroke = iconStrokeIn(glyph.parentElement ?? document.body)
			await expect(strokeWidth).toBeCloseTo(
				iconStroke * ICON_GRID_UNITS_PER_PIXEL_AT_16PX,
				1,
			)
		}
	},
})
