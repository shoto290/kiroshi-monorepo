import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { OnboardingTestCard } from "@workspace/ui/components/onboarding-test-card"

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingTestCard",
	component: OnboardingTestCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The card that says the account works and names the one step left. Reach for it once the connection settled; `OnboardingPickerCard` follows it.",
			},
		},
	},
	args: { onPickCompanion: fn(), onKeepTalking: fn() },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The second step of three. Check that the counter reads 2 of 3, that the title carries both sentences on the same line rhythm, and that Tab reaches the two exits in reading order.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Pick my first companion" }),
		)
		await expect(args.onPickCompanion).toHaveBeenCalledTimes(1)

		await userEvent.click(canvas.getByRole("button", { name: "Keep talking" }))
		await expect(args.onKeepTalking).toHaveBeenCalledTimes(1)
	},
})
