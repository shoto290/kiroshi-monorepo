import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	expectControlFrame,
	expectFocusRing,
} from "@workspace/storybook/story-utils"
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

const ARTBOARD_SEARCH =
	"The search field on the frame of the artboard V1e text field, light and dark side by side: a `muted` fill, a 1px `input` outline, the `radius-control` corner and 12px inline padding, held at the 36px height of the row it shares with a 36px button. "

const shellsIn = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLElement>("label"),
]

const expectArtboardShell = async (shell: HTMLElement) => {
	await expectControlFrame(shell)
	await expect(getComputedStyle(shell).paddingInlineStart).toBe("12px")
}

export const ThemesAtRest = meta.story({
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: { description: { story: `${ARTBOARD_SEARCH}Empty.` } },
	},
	play: async ({ canvasElement }) => {
		const shells = shellsIn(canvasElement)
		await expect(shells.length).toBe(2)
		for (const shell of shells) await expectArtboardShell(shell)
	},
})

export const ThemesFilled = meta.story({
	globals: { theme_layout: "side-by-side" },
	args: { value: "linear" },
	parameters: {
		docs: { description: { story: `${ARTBOARD_SEARCH}Holding a query.` } },
	},
	play: async ({ canvasElement }) => {
		for (const shell of shellsIn(canvasElement))
			await expectArtboardShell(shell)
	},
})

export const ThemesFocusVisible = meta.story({
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				story: `${ARTBOARD_SEARCH}Focus inside keeps the existing \`ring\` outline and halo on the shell.`,
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const shell of shellsIn(canvasElement)) {
			shell.querySelector("input")?.focus()
			await expectFocusRing(shell)
		}
	},
})
