import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	ApplicationsSearchField,
	type ApplicationsSearchFieldProps,
} from "@workspace/ui/components/plugin-settings/applications-search-field"

const FIELD_HEIGHT = 36

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
		await expect(
			Math.round(
				(field.closest("label") as HTMLElement).getBoundingClientRect().height,
			),
		).toBe(FIELD_HEIGHT)
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
