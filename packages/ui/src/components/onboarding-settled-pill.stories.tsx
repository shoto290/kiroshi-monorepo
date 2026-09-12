import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { OnboardingSettledPill } from "@workspace/ui/components/onboarding-settled-pill"

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingSettledPill",
	component: OnboardingSettledPill,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The line the transcript keeps once the connection step is behind the reader: a check, four words, and nothing to act on. It sits on the bubble column rather than on the turn's leading edge, so it reads as part of the conversation and not as a banner over it.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The connection step, settled. Check that the pill starts at the bubble column, that the check carries the settled colour while the words carry the meaning, and that it takes no keyboard stop since there is nothing to do with it.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const pill = slotIn(canvasElement, "onboarding-settled-pill")

		await expect(canvas.getByText("Claude account connected")).toBeVisible()
		await expect(getComputedStyle(pill).marginInlineStart).toBe("48px")
	},
})
