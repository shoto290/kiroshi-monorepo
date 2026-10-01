import { expect, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { JoinSpaceDialog } from "@workspace/ui/components/join-space-dialog"

const LINK = "kiroshi://join/northwind.example.com:4317/7f3a9c2e"

const LONG_LINK =
	"kiroshi://join/northwind-research-and-development.internal.example.com:4317/7f3a9c2e5b1d4a6f8e0c3b7a9d2f4e6c8b0a1d3f5e7c9b2a4d6f8e0c2b4a6d8f"

const joinDialog = async () => {
	const popup = await screen.findByRole("dialog", { name: "Join a space" })
	await waitFor(() => expect(popup).toBeVisible())
	return popup
}

const meta = preview.meta({
	title: "Overlays/JoinSpaceDialog",
	component: JoinSpaceDialog,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"Where a person joins a space hosted on another Kiroshi, by pasting the link that host hands out. It draws and reports, nothing more: the caller owns the link, decides the state after reading it and probing the host, and runs the join. Join stays enabled after a failure so the same press retries, and the dialog refuses to close while a join is in flight so the outcome is never lost.",
			},
		},
	},
	args: {
		link: "",
		state: "idle" as const,
		open: true,
		onLinkChange: fn(),
		onJoin: fn(),
		onOpenChange: fn(),
	},
	argTypes: {
		state: {
			control: "inline-radio",
			options: ["idle", "joining", "invalidLink", "hostUnreachable"],
		},
	},
})

export const Empty = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The dialog as it opens: nothing pasted yet. Check that focus lands in the link control so a paste works without a click, and that Join is disabled until there is something to join.",
			},
		},
	},
	play: async ({ args }) => {
		const popup = await joinDialog()
		const control = within(popup).getByRole("textbox", { name: "Link" })

		await waitFor(() => expect(control).toHaveFocus())
		await expect(control).toHaveAttribute("placeholder", "Paste a link")
		await expect(
			within(popup).getByRole("button", { name: "Join" }),
		).toBeDisabled()
		await expect(args.onJoin).not.toHaveBeenCalled()
	},
})

export const LinkPasted = meta.story({
	args: { link: LINK },
	parameters: {
		docs: {
			description: {
				story:
					"A link pasted, nothing checked yet: the moment before the press. Check that Join is enabled and that Enter in the control asks for the join exactly once, so the hand never leaves the keyboard.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const popup = await joinDialog()
		const control = within(popup).getByRole("textbox", { name: "Link" })

		await waitFor(() => expect(control).toHaveFocus())
		await expect(
			within(popup).getByRole("button", { name: "Join" }),
		).toBeEnabled()

		await userEvent.keyboard("{Enter}")
		await expect(args.onJoin).toHaveBeenCalledTimes(1)
	},
})

export const InvalidLink = meta.story({
	args: { link: "northwind.example.com", state: "invalidLink" },
	parameters: {
		docs: {
			description: {
				story:
					"The pasted text is not a Kiroshi link. Check that the control wears the invalid style, that the alert names the fix, and that the control points at it so a screen reader reads it with the field. Join stays enabled: a corrected paste retries on the same press.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const popup = await joinDialog()
		const control = within(popup).getByRole("textbox", { name: "Link" })
		const alert = within(popup).getByRole("alert")

		await expect(alert).toHaveTextContent(
			"That isn’t a Kiroshi link. Copy it again from the host.",
		)
		await expect(control).toHaveAttribute("aria-invalid", "true")
		await expect(control).toHaveAccessibleDescription(alert.textContent ?? "")
		await expect(
			within(popup).getByRole("button", { name: "Join" }),
		).toBeEnabled()

		await waitFor(() => expect(control).toHaveFocus())
		await userEvent.tab()
		await expect(control).not.toHaveFocus()
		await expect(getComputedStyle(control).boxShadow).not.toBe("none")
	},
})

export const Joining = meta.story({
	args: { link: LINK, state: "joining" },
	parameters: {
		docs: {
			description: {
				story:
					"The join in flight. Check that the control is read only, that both buttons are disabled, that Join spins its loading mark before Joining…, and that neither Escape nor a press outside closes the dialog: the outcome lands here.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const popup = await joinDialog()

		await expect(
			within(popup).getByRole("textbox", { name: "Link" }),
		).toHaveAttribute("readonly")
		await expect(
			within(popup).getByRole("button", { name: "Cancel" }),
		).toBeDisabled()
		await expect(
			within(popup).getByRole("button", { name: "Joining…" }),
		).toBeDisabled()

		await userEvent.keyboard("{Enter}")
		await userEvent.keyboard("{Escape}")
		await expect(args.onOpenChange).not.toHaveBeenCalled()
		await expect(args.onJoin).not.toHaveBeenCalled()
		await expect(popup).toBeVisible()
	},
})

export const HostUnreachable = meta.story({
	args: { link: LINK, state: "hostUnreachable" },
	parameters: {
		docs: {
			description: {
				story:
					"The link reads fine but its host did not answer. Check that the control keeps its normal style, since the link is not at fault, that the alert says what to check, and that Join is enabled to retry.",
			},
		},
	},
	play: async () => {
		const popup = await joinDialog()
		const control = within(popup).getByRole("textbox", { name: "Link" })

		await expect(within(popup).getByRole("alert")).toHaveTextContent(
			"Couldn’t reach the host. Check it’s open, then retry.",
		)
		await expect(control).not.toHaveAttribute("aria-invalid")
		await expect(
			within(popup).getByRole("button", { name: "Join" }),
		).toBeEnabled()
	},
})

export const LongContent = meta.story({
	args: { link: LONG_LINK },
	parameters: {
		docs: {
			description: {
				story:
					"A link far longer than the field. Check that it stays on one line and ends in an ellipsis once the control loses focus, and that the popup keeps its width instead of growing with the link.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const popup = await joinDialog()
		const control = within(popup).getByRole("textbox", { name: "Link" })

		await userEvent.tab()
		await expect(getComputedStyle(control).textOverflow).toBe("ellipsis")
		await expect(popup.getBoundingClientRect().width).toBe(352)
	},
})
