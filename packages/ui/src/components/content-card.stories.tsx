import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { ContentCard } from "@workspace/ui/components/content-card"
import { AnimatedSidebarProvider } from "@workspace/ui/components/motion/animated-sidebar"

const GUTTER = 4

const CONTENT = (
	<p className="p-4 text-sm">Whatever screen the shell hands the room to.</p>
)

const cardsIn = (canvasElement: HTMLElement) =>
	Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-content-card]"))

const expectCarriesCard = async (card: HTMLElement) => {
	const painted = getComputedStyle(card)
	await expect(painted.borderTopWidth).toBe("1px")
	await expect(painted.borderInlineStartWidth).toBe(
		painted.borderInlineEndWidth,
	)
	await expect(painted.borderStartStartRadius).toBe(
		painted.borderStartEndRadius,
	)
	await expect(painted.borderStartStartRadius).not.toBe("0px")
	await expect(painted.overflow).toBe("hidden")
	await expect(painted.marginTop).toBe(`${GUTTER}px`)
}

const meta = preview.meta({
	title: "Layout/ContentCard",
	component: ContentCard,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The one piece that draws the content card: the gutter, the radius, the border and the background that lift a screen off the shell surface. Every host that hands room to a screen renders it — the shell around a screen with no side panel, and the activity panel around the thread it sits beside — so the treatment is written once and can never drift between the two. A card that ends up containing another card yields: it drops its own gutter, radius, border and background so the innermost card is the only frame, which is what lets the panel sit outside the frame on the shell surface.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => (
		<AnimatedSidebarProvider>
			<ContentCard>{CONTENT}</ContentCard>
		</AnimatedSidebarProvider>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The card as a screen with no side panel gets it. Check that the shell surface shows through on all four sides with the same gutter, that the border and the radius read the same on the inline-start and the inline-end edge, and that the content is clipped by the radius rather than squaring the corners. Pick `WithNestedCard` for the shape the activity panel puts it in.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [card] = cardsIn(canvasElement)
		await expect(card).toBeDefined()
		if (card) await expectCarriesCard(card)
	},
})

export const WithNestedCard = meta.story({
	render: () => (
		<AnimatedSidebarProvider>
			<ContentCard>
				<AnimatedSidebarProvider>
					<ContentCard isLandmark={false}>{CONTENT}</ContentCard>
				</AnimatedSidebarProvider>
			</ContentCard>
		</AnimatedSidebarProvider>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A card holding a host that draws a card of its own, which is what the activity panel does to the shell. Check that only one frame is visible: the outer card keeps no gutter, no border, no radius and no background of its own, so the shell surface runs under the inner card and out to the window edge. Pick `Default` for the single card.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [outer, inner] = cardsIn(canvasElement)
		await expect(outer).toBeDefined()
		await expect(inner).toBeDefined()
		if (!(outer && inner)) return

		const yielded = getComputedStyle(outer)
		await expect(yielded.borderTopWidth).toBe("0px")
		await expect(yielded.borderStartStartRadius).toBe("0px")
		await expect(yielded.marginTop).toBe("0px")
		await expect(yielded.backgroundColor).toBe("rgba(0, 0, 0, 0)")
		await expectCarriesCard(inner)
	},
})
