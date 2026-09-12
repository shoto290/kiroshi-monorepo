import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { OnboardingHandoffCard } from "@workspace/ui/components/onboarding-handoff-card"

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingHandoffCard",
	component: OnboardingHandoffCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The card that hands the reader over to the companion onboarding just added: its identity avatar, its name, the one line it is good for, and the choice between opening it and staying here. The last card of the run.",
			},
		},
	},
	args: {
		name: "Scout",
		description: "Looks things up and reports back short",
		seed: "scout",
		onOpen: fn(),
		onStay: fn(),
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The companion just added, drawn with the identity avatar the rest of the app knows it by. Check that the primary exit names the companion rather than saying Open, that the avatar is decoration beside a name that is already read, and that Tab reaches the two exits in reading order.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText("Scout")).toBeVisible()
		await expect(
			canvas.getByText("Looks things up and reports back short"),
		).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "Open Scout" }))
		await expect(args.onOpen).toHaveBeenCalledTimes(1)

		await userEvent.click(canvas.getByRole("button", { name: "Stay here" }))
		await expect(args.onStay).toHaveBeenCalledTimes(1)
	},
})
