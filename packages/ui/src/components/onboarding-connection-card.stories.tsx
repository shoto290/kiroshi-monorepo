import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { OnboardingConnectionCard } from "@workspace/ui/components/onboarding-connection-card"

const ACCOUNT_LINE = "Signed in with your Claude subscription"

const LONG_ACCOUNT_LINE =
	"Signed in with the Claude subscription this machine keeps for ada@example.com, the login it was set up with"

const EXIT_DETAIL = "auth login exited with code 1"

const LONG_EXIT_DETAIL =
	"auth login exited with code 1: no browser answered the callback on localhost:54545 before the attempt timed out"

type OfferHostProps = { disabled?: boolean }

const OfferHost = ({ disabled }: OfferHostProps) => {
	const [apiKey, setApiKey] = useState("")

	return (
		<OnboardingConnectionCard
			apiKey={apiKey}
			disabled={disabled}
			onApiKeyChange={setApiKey}
			onApiKeySubmit={fn()}
			onSignIn={fn()}
			state="offer"
		/>
	)
}

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingConnectionCard",
	component: OnboardingConnectionCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The first step of onboarding, in the three shapes it takes: the account already on the machine, the offer to sign in or pay per use, and the attempt that failed. One card, one title, one counter — the failure is drawn inside it rather than beside it.",
			},
		},
	},
	args: {
		state: "detected",
		account: ACCOUNT_LINE,
		onUseAccount: fn(),
		onUseAnotherAccount: fn(),
	},
})

export const Detected = meta.story({
	render: () => (
		<OnboardingConnectionCard
			account={ACCOUNT_LINE}
			onUseAccount={fn()}
			onUseAnotherAccount={fn()}
			state="detected"
		/>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A Claude login found on this machine. Check that the dot reads as settled rather than as an alert, that the account line comes from the app and the line under it from the catalogue, and that both exits are reachable in reading order. Pick `Offer` for the machine with no login on it.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await expect(slotIn(canvasElement, "onboarding-status")).toHaveTextContent(
			ACCOUNT_LINE,
		)
		await expect(
			canvas.getByText("Found on this machine, under your own login"),
		).toBeVisible()

		const use = canvas.getByRole("button", { name: "Use this account" })

		await userEvent.tab()
		await expect(use).toHaveFocus()
		await userEvent.tab()
		await expect(
			canvas.getByRole("button", { name: "Use another account" }),
		).toHaveFocus()
	},
})

export const Offer = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"No login on the machine: sign in with Claude, or paste an API key and pay per use. Check that the button, its note and the key field come in that order, that the field is reached by Tab after the button, and that the note says the browser opens once. Pick `Error` for the sign-in that came back empty-handed.",
			},
		},
	},
	render: () => <OfferHost />,
	play: async ({ canvas, canvasElement, userEvent }) => {
		const signIn = canvas.getByRole("button", {
			name: "Sign in with Claude",
		})
		const note = canvas.getByText(
			"Opens your browser once, then comes back here.",
		)
		const field = slotIn(canvasElement, "onboarding-field")

		await expect(
			signIn.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			note.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()

		await userEvent.tab()
		await expect(signIn).toHaveFocus()
		const key = canvas.getByLabelText("Or paste an API key and pay per use")

		await userEvent.tab()
		await expect(key).toHaveFocus()

		await userEvent.type(key, "sk-ant-test")
		await expect(key).toHaveValue("sk-ant-test")
	},
})

export const OfferDisabled = meta.story({
	render: () => <OfferHost disabled />,
	parameters: {
		docs: {
			description: {
				story:
					"The offer while the app is answering the sign-in already asked for. Check that the button and the key field both wear the primitive's own disabled treatment, and above all that the field takes no typing, so a key cannot be half-entered into a card that is no longer listening. Pick `Offer` for the same card once the app is free again.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const key = canvas.getByLabelText("Or paste an API key and pay per use")

		await expect(key).toBeDisabled()
		await expect(
			canvas.getByRole("button", { name: "Sign in with Claude" }),
		).toBeDisabled()

		key.focus()
		await userEvent.keyboard("sk-ant-test")
		await expect(key).toHaveValue("")
	},
})

export const Error = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The sign-in came back with an exit code. Check that the card keeps its own title and counter, that the failure is named in words and not only by the colour of the dot, that the exit detail is readable in its monospace chip, and that Try again leads the row. Pick `Offer` for the state this one returns to through Paste a key instead.",
			},
		},
	},
	render: () => (
		<OnboardingConnectionCard
			exitDetail={EXIT_DETAIL}
			onPasteKey={fn()}
			onRetry={fn()}
			state="failed"
		/>
	),
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Your Claude account")).toBeVisible()
		await expect(canvas.getByText("1 of 3")).toBeVisible()
		await expect(canvas.getByText("Couldn't sign you in")).toBeVisible()
		await expect(
			slotIn(canvasElement, "onboarding-exit-detail"),
		).toHaveTextContent(EXIT_DETAIL)
		await expect(
			canvas.getByRole("button", { name: "Paste a key instead" }),
		).toBeVisible()
	},
})

export const LongContent = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"An account line and an exit detail long enough to run to three lines, in a container squeezed to 320 pixels. Check that both wrap instead of overflowing, that the chip never grows wider than the card, that the dot stays on the first line of its status, and that nothing scrolls sideways.",
			},
		},
	},
	render: () => (
		<div className="flex w-80 max-w-full flex-col gap-3">
			<OnboardingConnectionCard
				account={LONG_ACCOUNT_LINE}
				onUseAccount={fn()}
				onUseAnotherAccount={fn()}
				state="detected"
			/>
			<OnboardingConnectionCard
				exitDetail={LONG_EXIT_DETAIL}
				onPasteKey={fn()}
				onRetry={fn()}
				state="failed"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const chip = slotIn(canvasElement, "onboarding-exit-detail")

		await expect(chip.scrollWidth).toBeLessThanOrEqual(chip.clientWidth)
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)
	},
})
