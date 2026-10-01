import { expect, fn, spyOn, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { CopyField } from "@workspace/ui/components/copy-field"

const VALUE = "http://127.0.0.1:45367/routines/call"

const meta = preview.meta({
	title: "Forms/CopyField",
	component: CopyField,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"A labelled read-only value with a control that copies it. The value stays on one line and ends in an ellipsis when it runs past the field; the control turns to a check once the copy lands and the copy is announced in a polite region. An empty value draws the field alone, with no control to copy nothing.",
			},
		},
	},
	args: {
		label: "Address",
		value: VALUE,
		copyLabel: "Copy the address",
		copiedLabel: "Address copied",
		onCopy: fn(),
	},
	render: (args) => (
		<div className="max-w-md">
			<CopyField {...args} />
		</div>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A value and its copy control. Check that the whole value lands on the clipboard, that `onCopy` fires once, and that the copy is announced.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const writeText = spyOn(
			navigator.clipboard,
			"writeText",
		).mockResolvedValue()

		await expect(canvas.getByLabelText("Address")).toHaveAttribute("readonly")
		await userEvent.click(
			canvas.getByRole("button", { name: "Copy the address" }),
		)

		await expect(writeText).toHaveBeenCalledWith(VALUE)
		await waitFor(() => expect(args.onCopy).toHaveBeenCalledOnce())
		await expect(await canvas.findByText("Address copied")).toBeInTheDocument()

		writeText.mockRestore()
	},
})

export const Empty = meta.story({
	args: { value: "" },
	parameters: {
		docs: {
			description: {
				story:
					"No value yet. Check that the field keeps its height and that no copy control is drawn.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByLabelText("Address")).toHaveValue("")
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
	},
})
