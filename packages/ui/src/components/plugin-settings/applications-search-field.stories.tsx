import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	ApplicationsSearchField,
	type ApplicationsSearchFieldProps,
} from "@workspace/ui/components/plugin-settings/applications-search-field"

const FIELD_HEIGHT = 36
const ENLARGED_ROOT_TEXT = "32px"

const shellOf = (field: HTMLElement) =>
	(field.closest("label") as HTMLElement).getBoundingClientRect()

const expectLineCentredInShell = async (field: HTMLElement) => {
	const shell = shellOf(field)
	const line = field.getBoundingClientRect()

	await expect(line.top).toBeGreaterThanOrEqual(shell.top)
	await expect(line.bottom).toBeLessThanOrEqual(shell.bottom)
	await expect(Math.round(line.top - shell.top)).toBe(
		Math.round(shell.bottom - line.bottom),
	)
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

export const RootTextEnlarged = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The root text size doubled. Check that the shell grows past its default height and that the whole typed line, descenders included, stays inside the shell and centred on it.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const root = document.documentElement
		const rootTextAtRest = root.style.fontSize

		try {
			const field = canvas.getByRole("textbox", { name: "Search applications" })

			await userEvent.type(field, "typography")
			await expectLineCentredInShell(field)

			root.style.fontSize = ENLARGED_ROOT_TEXT

			await expect(shellOf(field).height).toBeGreaterThan(FIELD_HEIGHT)
			await expectLineCentredInShell(field)
		} finally {
			root.style.fontSize = rootTextAtRest
		}
	},
})
