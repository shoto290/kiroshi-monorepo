import { expect, fn, spyOn, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { ShareLink } from "@workspace/ui/components/space-settings-dialog/share-link"
import { SHARE_LINK } from "@workspace/ui/components/space-settings-dialog/share-link.fixtures"

const meta = preview.meta({
	title: "Settings/Space/ShareLink",
	component: ShareLink,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The link another Kiroshi pastes in Join a space to get this space. A read-only field holds the whole link on one line, cut with an ellipsis, beside a copy control; under it a hint says where the link goes and a line marked with a key says what it hands over. The section only draws what it is given: the app passes the link, or null while the host is not up, and hears about each copy through `onCopy`.",
			},
		},
	},
	args: {
		link: SHARE_LINK,
		onCopy: fn(),
	},
	render: (args) => (
		<div className="max-w-md">
			<ShareLink {...args} />
		</div>
	),
})

export const AtRest = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The link as the host hands it out. Check that the field reads as read only, that the link stays on one line and ends in an ellipsis, and that the field is described by the hint and by the warning line.",
			},
		},
	},
	play: async ({ canvas }) => {
		const field = canvas.getByLabelText("Share link")

		await expect(field).toHaveAttribute("readonly")
		await expect(field).toHaveValue(SHARE_LINK)
		await expect(field).toHaveAccessibleDescription(
			"Paste it in Join a space on another Kiroshi. Anyone with this link gets this space, its companions and its conversations.",
		)
		await expect(
			canvas.getByRole("button", { name: "Copy the share link" }),
		).toBeVisible()
	},
})

export const CopyFocused = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The copy control reached from the keyboard. Check that it wears the focus ring every other control wears.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.tab()
		await userEvent.tab()

		await expect(
			canvas.getByRole("button", { name: "Copy the share link" }),
		).toHaveFocus()
	},
})

export const Copied = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Right after a copy. Check that the whole link lands on the clipboard, that `onCopy` fires once, that the control turns to a check on its hover fill, and that the copy is announced in the polite region rather than through the icon alone.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const writeText = spyOn(
			navigator.clipboard,
			"writeText",
		).mockResolvedValue()

		await userEvent.click(
			canvas.getByRole("button", { name: "Copy the share link" }),
		)

		await expect(writeText).toHaveBeenCalledWith(SHARE_LINK)
		await waitFor(() => expect(args.onCopy).toHaveBeenCalledOnce())
		await expect(
			await canvas.findByText("Share link copied"),
		).toBeInTheDocument()

		writeText.mockRestore()
	},
})

export const HostNotUp = meta.story({
	args: { link: null },
	parameters: {
		docs: {
			description: {
				story:
					"No link yet because the host is not running. Check that the empty field keeps its rest height, that no copy control and no warning line are drawn, and that the hint says how to get a link instead.",
			},
		},
	},
	play: async ({ canvas }) => {
		const field = canvas.getByLabelText("Share link")

		await expect(field).toHaveValue("")
		await expect(field).toHaveAccessibleDescription(
			"The host isn’t running, so there’s no link yet. Restart Kiroshi to start it.",
		)
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
		await expect(
			canvas.queryByText(/Anyone with this link/),
		).not.toBeInTheDocument()
	},
})
