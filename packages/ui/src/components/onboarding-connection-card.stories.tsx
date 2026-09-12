import { useState } from "react"
import { expect, fn, spyOn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn, slotsIn } from "@workspace/storybook/story-utils"
import { OnboardingConnectionCard } from "@workspace/ui/components/onboarding-connection-card"
import { i18n } from "@workspace/ui/lib/i18n"

const ACCOUNT_LINE = "Signed in with your Claude subscription"

const LONG_ACCOUNT_LINE =
	"Signed in with the Claude subscription this machine keeps for ada@example.com, the login it was set up with"

const EXIT_DETAIL = "auth login exited with code 1"

const LONG_EXIT_DETAIL =
	"auth login exited with code 1: no browser answered the callback on localhost:54545 before the attempt timed out"

const SIGN_IN_URL = "https://claude.ai/oauth/authorize?code=true&state=8f3c1a"

const LONG_SIGN_IN_URL =
	"https://claude.ai/oauth/authorize?code=true&client_id=9d1b7f0e-4c62-4a58-9f31-6b0d2e5a7c84&redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback&state=8f3c1a2b4d6e8f0a1c3e5d7b9f1a3c5e"

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

type WaitingHostProps = {
	disabled?: boolean
	signInUrl?: string
	onCodeSubmit?: (code: string) => void
}

const WaitingHost = ({
	disabled,
	signInUrl = SIGN_IN_URL,
	onCodeSubmit = fn(),
}: WaitingHostProps) => {
	const [code, setCode] = useState("")

	return (
		<OnboardingConnectionCard
			code={code}
			disabled={disabled}
			onCodeChange={setCode}
			onCodeSubmit={onCodeSubmit}
			onPasteKey={fn()}
			signInUrl={signInUrl}
			state="waiting"
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
					"The first step of onboarding, in the four shapes it takes: the account already on the machine, the offer to sign in or pay per use, the sign-in in progress with the link to open and the code to paste back, and the attempt that failed. One card, one title, one counter — the sign-in step and the failure are drawn inside it rather than beside it.",
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

const waitingSubmit = fn()

export const Waiting = meta.story({
	render: () => <WaitingHost onCodeSubmit={waitingSubmit} />,
	parameters: {
		docs: {
			description: {
				story:
					"The sign-in in progress, drawn as the two steps it really is: open this link, then paste the code back. Check that nothing here reads as an alert — no dot, no status line — that the two step lines carry the same type and start padding as any onboarding field label, that the only rule sits above the footer, that the link is read only and copies whole, that a refused copy says so in the polite region while a copy that worked is announced by the control alone, that Continue on an empty field sends the person back to it rather than submitting, and that Enter and Continue submit the same value. Pick `Error` for the attempt that came back with an exit code.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		waitingSubmit.mockClear()

		await expect(canvas.getByText("Your Claude account")).toBeVisible()
		await expect(canvas.getByText("1 of 3")).toBeVisible()
		await expect(slotsIn(canvasElement, "onboarding-status")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "onboarding-status-dot")).toHaveLength(
			0,
		)

		const linkStep = canvas.getByText("Open this link and sign in")
		const link = canvas.getByLabelText("Sign-in link")

		await expect(link).toHaveAttribute("readonly")
		await expect(link).toHaveValue(SIGN_IN_URL)

		const writeText = spyOn(navigator.clipboard, "writeText").mockRejectedValue(
			new DOMException("Write permission denied.", "NotAllowedError"),
		)
		const copy = canvas.getByRole("button", { name: "Copy the sign-in link" })

		await userEvent.click(copy)
		await expect(
			await canvas.findByText(
				"Couldn't copy. Select the link and copy it yourself.",
			),
		).toBeInTheDocument()
		await expect(copy).toHaveTextContent(/^Copy$/)

		writeText.mockResolvedValue()
		await userEvent.click(copy)
		await expect(writeText).toHaveBeenLastCalledWith(SIGN_IN_URL)
		await expect(
			await canvas.findByRole("button", { name: "Sign-in link copied" }),
		).toHaveTextContent(/^Copied$/)
		await expect(
			canvas.queryByText("Sign-in link copied"),
		).not.toBeInTheDocument()
		await expect(
			canvas.queryByText(
				"Couldn't copy. Select the link and copy it yourself.",
			),
		).not.toBeInTheDocument()

		writeText.mockRestore()

		const field = canvas.getByLabelText("Then paste the code it gives you")
		const codeStep = canvas.getByText("Then paste the code it gives you")
		const submit = canvas.getByRole("button", { name: "Continue" })
		const exit = canvas.getByRole("button", { name: "Paste a key instead" })

		const muted = getComputedStyle(canvas.getByText("1 of 3")).color

		for (const step of [linkStep, codeStep]) {
			const type = getComputedStyle(step)

			await expect(type.fontSize).toBe("12px")
			await expect(type.lineHeight).toBe("16px")
			await expect(type.paddingInlineStart).toBe("4px")
			await expect(type.color).toBe(muted)
		}

		const codeBlock = slotIn(canvasElement, "onboarding-field")
		const footer = slotIn(canvasElement, "onboarding-actions")

		await expect(getComputedStyle(codeBlock).borderTopWidth).toBe("0px")
		await expect(getComputedStyle(footer).borderTopWidth).toBe("1px")
		await expect(getComputedStyle(footer).paddingTop).toBe("10px")

		await userEvent.click(submit)
		await expect(waitingSubmit).not.toHaveBeenCalled()
		await expect(field).toHaveFocus()

		await userEvent.type(field, "abc123#8f3c1a")
		await expect(field).toHaveValue("abc123#8f3c1a")

		await userEvent.keyboard("{Enter}")
		await expect(waitingSubmit).toHaveBeenCalledTimes(1)
		await userEvent.click(submit)
		await expect(waitingSubmit).toHaveBeenCalledTimes(2)
		await expect(waitingSubmit).toHaveBeenLastCalledWith("abc123#8f3c1a")

		await expect(
			linkStep.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			link.compareDocumentPosition(codeStep) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			codeStep.compareDocumentPosition(field) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			submit.compareDocumentPosition(exit) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()

		link.focus()
		await userEvent.tab()
		await expect(copy).toHaveFocus()
		await userEvent.tab()
		await expect(field).toHaveFocus()
		await userEvent.tab()
		await expect(submit).toHaveFocus()
		await userEvent.tab()
		await expect(exit).toHaveFocus()
	},
})

export const WaitingWithALongLink = meta.story({
	render: () => (
		<div className="w-80 max-w-full">
			<WaitingHost signInUrl={LONG_SIGN_IN_URL} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The same sign-in step at 320 pixels, with a link far longer than its row. Check that the link stays on one line and is cut rather than wrapped, that the copy control keeps its full size beside it instead of being squeezed, that nothing scrolls sideways, and above all that copying writes the whole link and not the piece on screen.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const writeText = spyOn(
			navigator.clipboard,
			"writeText",
		).mockResolvedValue()
		const link = canvas.getByLabelText("Sign-in link")
		const copy = canvas.getByRole("button", { name: "Copy the sign-in link" })

		await expect(link.scrollWidth).toBeGreaterThan(link.clientWidth)
		await expect(copy.clientWidth).toBe(copy.scrollWidth)
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)

		await userEvent.click(copy)
		await expect(writeText).toHaveBeenCalledWith(LONG_SIGN_IN_URL)

		writeText.mockRestore()
	},
})

export const WaitingWithoutAClipboard = meta.story({
	render: () => <WaitingHost />,
	parameters: {
		docs: {
			description: {
				story:
					"The same sign-in step in a browser that exposes no clipboard at all. Check that the control reads as uncopied rather than claiming a copy that never happened, and that the polite region tells the person to select the link and copy it by hand. Pick `Waiting` for the browser that has a clipboard but refuses the write.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		})

		const copy = canvas.getByRole("button", { name: "Copy the sign-in link" })

		await userEvent.click(copy)
		Reflect.deleteProperty(navigator, "clipboard")

		await expect(
			await canvas.findByText(
				"Couldn't copy. Select the link and copy it yourself.",
			),
		).toBeInTheDocument()
		await expect(copy).toHaveTextContent(/^Copy$/)
		await expect(navigator.clipboard).toBeDefined()
	},
})

export const WaitingInFrench = meta.story({
	beforeEach: async () => {
		await i18n.changeLanguage("fr")

		return async () => {
			await i18n.changeLanguage("en")
		}
	},
	render: () => (
		<div className="w-80 max-w-full">
			<WaitingHost />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The sign-in step at 320 pixels in French, where both step lines run longer than their English originals. Check that each line is laid out to wrap rather than to be cut, that both keep the field label type at 12 over 16, that both are readable whole, and that the row under each holds the width without scrolling sideways. Pick `Waiting` for the same step in English at full width.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const steps = [
			canvas.getByText("Ouvrez ce lien et connectez-vous"),
			canvas.getByText("Puis collez le code qu'il vous donne"),
		]

		for (const step of steps) {
			const type = getComputedStyle(step)

			await expect(type.whiteSpace).toBe("normal")
			await expect(type.overflowWrap).toBe("break-word")
			await expect(type.fontSize).toBe("12px")
			await expect(type.lineHeight).toBe("16px")
			await expect(step.scrollWidth).toBeLessThanOrEqual(step.clientWidth)
			await expect(step.scrollHeight).toBe(step.clientHeight)
		}

		await expect(
			canvas.getByRole("button", { name: "Continuer" }),
		).toBeVisible()
		await expect(
			canvas.getByRole("button", { name: "Coller une clé à la place" }),
		).toBeVisible()
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)
	},
})

export const WaitingDisabled = meta.story({
	render: () => <WaitingHost disabled />,
	parameters: {
		docs: {
			description: {
				story:
					"The sign-in step while the app is busy with the code it was already handed. Check that the code field, Continue and the exit all read as disabled and that the field takes no typing, so a code cannot be half-entered into a card that is no longer listening — and that the copy control keeps working anyway, because this step exists so the person can finish signing in outside the app and the clipboard waits on nothing the app is doing. Pick `Waiting` for the same step once the app is free again.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const field = canvas.getByLabelText("Then paste the code it gives you")

		await expect(field).toBeDisabled()
		await expect(
			canvas.getByRole("button", { name: "Continue" }),
		).toBeDisabled()
		await expect(
			canvas.getByRole("button", { name: "Paste a key instead" }),
		).toBeDisabled()
		await expect(canvas.getByLabelText("Sign-in link")).not.toBeDisabled()

		field.focus()
		await userEvent.keyboard("abc123#8f3c1a")
		await expect(field).toHaveValue("")

		const writeText = spyOn(
			navigator.clipboard,
			"writeText",
		).mockResolvedValue()
		const copy = canvas.getByRole("button", { name: "Copy the sign-in link" })

		await expect(copy).not.toBeDisabled()
		await userEvent.click(copy)
		await expect(writeText).toHaveBeenCalledWith(SIGN_IN_URL)
		await expect(
			await canvas.findByRole("button", { name: "Sign-in link copied" }),
		).toHaveTextContent(/^Copied$/)

		writeText.mockRestore()
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
