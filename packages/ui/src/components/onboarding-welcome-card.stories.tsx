import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { OnboardingWelcomeCard } from "@workspace/ui/components/onboarding-welcome-card"

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingWelcomeCard",
	component: OnboardingWelcomeCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The card that opens onboarding: what is about to happen, how many steps it takes, and the two ways out of it. Reach for it on the first turn of a fresh install; `OnboardingConnectionCard` follows it.",
			},
		},
	},
	args: { onStart: fn(), onTellMore: fn() },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The card as a first run draws it. Check that the counter reads the number of steps, that Tab reaches Start then Tell me more first in that order, each with the ring the repo draws, and that both exits report to the app. Pick `Disabled` for the card while the app is busy answering.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const start = canvas.getByRole("button", { name: "Start" })
		const more = canvas.getByRole("button", { name: "Tell me more first" })

		await userEvent.tab()
		await expect(start).toHaveFocus()
		await userEvent.tab()
		await expect(more).toHaveFocus()

		await userEvent.click(start)
		await expect(args.onStart).toHaveBeenCalledTimes(1)
	},
})

export const Disabled = meta.story({
	args: { disabled: true },
	parameters: {
		docs: {
			description: {
				story:
					"The card while the app is answering the exit already taken. Check that both actions wear the primitive's own disabled treatment, that neither takes the pointer, and that the copy stays readable rather than dimming with them.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("button", { name: "Start" })).toBeDisabled()
		await expect(
			canvas.getByRole("button", { name: "Tell me more first" }),
		).toBeDisabled()
	},
})
