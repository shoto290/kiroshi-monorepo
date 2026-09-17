import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	ApplicationsSearchField,
	type ApplicationsSearchFieldProps,
} from "@workspace/ui/components/plugin-settings/applications-search-field"

const FIELD_HEIGHT = 36
const FLOORED_TEXT_SIZE = "32px"

const shellOf = (field: HTMLElement) =>
	(field.closest("label") as HTMLElement).getBoundingClientRect()

const expectLineCentredInShell = async (field: HTMLElement) => {
	const shell = shellOf(field)
	const line = field.getBoundingClientRect()
	const above = line.top - shell.top

	await expect(above).toBeGreaterThanOrEqual(0)
	await expect(Math.round(above)).toBe(Math.round(shell.bottom - line.bottom))
}

const SearchHost = (props: ApplicationsSearchFieldProps) => {
	const [value, setValue] = useState(props.value)

	return (
		<ApplicationsSearchField
			onValueChange={(next) => {
				setValue(next)
				props.onValueChange(next)
			}}
			value={value}
		/>
	)
}

const meta = preview.meta({
	title: "Settings/Plugins/ApplicationsSearchField",
	component: ApplicationsSearchField,
	decorators: [
		(Story) => (
			<div className="flex w-96">
				<Story />
			</div>
		),
	],
	parameters: {
		docs: {
			description: {
				component:
					"The one search field of the applications settings: the panel of installed applications and the catalogue both draw it, so the shell, the focus ring and the placeholder are written once. It carries no trailing text.",
			},
		},
	},
	args: { value: "", onValueChange: fn() },
	render: (args) => <SearchHost {...args} />,
})

export const AtRest = meta.story({
	play: async ({ canvas, canvasElement }) => {
		const field = canvas.getByRole("textbox", { name: "Search applications" })

		await expect(field).toHaveValue("")
		await expect(Math.round(shellOf(field).height)).toBe(FIELD_HEIGHT)
		await expect(canvasElement.textContent).toBe("")
	},
})

export const Typed = meta.story({
	parameters: {
		docs: {
			description: {
				story: "Every keystroke is reported to the owner of the text.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Search applications" }),
			"linear",
		)

		await expect(args.onValueChange).toHaveBeenLastCalledWith("linear")
	},
})

export const LargestTextSize = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A text-size floor the browser applies to the input alone, so the rendered line grows while the rem the shell is measured in does not. Check that the shell grows past its default height to hold the whole line, descenders included, centred on it.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const field = canvas.getByRole("textbox", { name: "Search applications" })

		field.style.fontSize = FLOORED_TEXT_SIZE

		await userEvent.type(field, "typography")

		await expect(shellOf(field).height).toBeGreaterThan(FIELD_HEIGHT)
		await expectLineCentredInShell(field)
	},
})
