import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { ContentCard } from "@workspace/ui/components/content-card"
import {
	SpaceRemovedScreen,
	type SpaceRemovedScreenProps,
} from "@workspace/ui/components/space-removed-screen"

const InShellCard = (props: SpaceRemovedScreenProps) => (
	<div className="flex h-screen p-2">
		<ContentCard isLandmark={false}>
			<SpaceRemovedScreen {...props} />
		</ContentCard>
	</div>
)

const meta = preview.meta({
	title: "Feedback/SpaceRemovedScreen",
	component: SpaceRemovedScreen,
	globals: { theme: "dark" },
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"What a guest sees once the host of a joined Space removed them: it takes the whole shell card, Conversations panel included, since nothing of that Space is theirs to open any more. A muted tile, the Space it was, who removed them and what stays behind, then one way out, back to a Space that is still theirs. It only reports `onBack`; choosing that Space belongs to the host.",
			},
		},
	},
	args: {
		spaceName: "Studio Nord",
		hostEmail: "lea@example.com",
		backSpaceName: "Perso",
		onBack: fn(),
	},
	render: (args) => <InShellCard {...args} />,
})

export const M7RemovedFromSpace = meta.story({
	name: "M7 Removed from Space",
	parameters: {
		docs: {
			description: {
				story:
					"Measured against the Paper page `Join an invited Space`, dark only (M7). Check the column sits centred in the card 16px apart, the 40px tile carries a 12px dot at 30% of the foreground on a 10% fill, the title reads in 16px medium over a muted 14px description capped at 400px, 6px below it, and the 32px outline button reports `onBack`.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const screen = slotIn(canvasElement, "space-removed-screen")
		const title = canvas.getByRole("heading", {
			name: "You’re no longer in Studio Nord",
		})
		await expect(screen).toHaveAccessibleName(title.textContent ?? "")
		await expect(getComputedStyle(screen).rowGap).toBe("16px")
		await expect(getComputedStyle(title).fontSize).toBe("16px")
		await expect(getComputedStyle(title).fontWeight).toBe("500")

		const description = canvas.getByText(
			"lea@example.com removed you from this Space. Its companions and conversations stay on their Kiroshi.",
		)
		await expect(description.getBoundingClientRect().width).toBeLessThanOrEqual(
			400,
		)
		await expect(
			description.getBoundingClientRect().top -
				title.getBoundingClientRect().bottom,
		).toBe(6)

		const tile = screen.firstElementChild
		if (!tile) throw new Error("The screen draws no tile")
		await expect(tile).toHaveAttribute("aria-hidden", "true")
		await expect(tile.getBoundingClientRect().width).toBe(40)
		await expect(tile.firstElementChild?.getBoundingClientRect().width).toBe(12)

		const back = canvas.getByRole("button", { name: "Back to Perso" })
		await expect(back.getBoundingClientRect().height).toBe(32)
		await expect(getComputedStyle(back).paddingInlineStart).toBe("14px")
		await userEvent.click(back)
		await expect(args.onBack).toHaveBeenCalledOnce()
	},
})

export const LongContent = meta.story({
	args: {
		spaceName: "Everything the research studio has not filed anywhere else yet",
		hostEmail: "lea.marchand-de-villeneuve.research-coordination@example.com",
		backSpaceName: "Reading list shared with the whole studio this quarter",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A Space named as a sentence and a host writing from one unbreakable address. Check the title and the description wrap inside the 400px column and the back button inside the card, the address breaking mid-word, and nothing overflows the card.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const screen = slotIn(canvasElement, "space-removed-screen")
		await expect(screen.scrollWidth).toBeLessThanOrEqual(screen.clientWidth)
		for (const line of screen.querySelectorAll<HTMLElement>("h2, p")) {
			await expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth)
			await expect(line.getBoundingClientRect().width).toBeLessThanOrEqual(400)
		}
		const back = within(screen).getByRole("button")
		await expect(back.scrollWidth).toBeLessThanOrEqual(back.clientWidth)
		await expect(back.getBoundingClientRect().right).toBeLessThanOrEqual(
			screen.getBoundingClientRect().right,
		)
	},
})
