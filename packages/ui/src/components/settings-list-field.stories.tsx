import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	expectControlRadius,
	expectFieldFrame,
	expectFocusRing,
	expectInvalidOutline,
} from "@workspace/storybook/story-utils"
import {
	SettingsListField,
	type SettingsListFieldProps,
} from "@workspace/ui/components/settings-list-field"

const ListHost = (props: SettingsListFieldProps) => {
	const [items, setItems] = useState(props.items)

	return (
		<SettingsListField
			{...props}
			items={items}
			onItemsChange={(next) => {
				setItems(next)
				props.onItemsChange(next)
			}}
		/>
	)
}

const meta = preview.meta({
	title: "Forms/SettingsListField",
	component: SettingsListField,
	render: (args) => (
		<div className="w-96">
			<ListHost {...args} />
		</div>
	),
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"A list the reader writes one line at a time: type, press Add, and the line joins the rows underneath with its own way out. Reach for it wherever a setting is a set rather than a sentence — permission rules, folders, anything the reader collects. The field refuses a line it cannot accept instead of taking it and losing it later, and it says why under the input.",
			},
		},
	},
	args: {
		label: "Denied",
		items: ["Bash", "Edit"],
		onItemsChange: fn(),
		placeholder: "Tool or Tool(specifier)",
		addLabel: "Add",
		removeLabel: (item: string) => `Remove ${item}`,
		emptyLabel: "Nothing listed.",
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Knob story. Check that a long line truncates in its row rather than widening the panel, and that the Add button keeps its size while the input takes the rest.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("Denied"), "Write")
		await userEvent.click(canvas.getByRole("button", { name: "Add" }))

		await expect(args.onItemsChange).toHaveBeenCalledWith([
			"Bash",
			"Edit",
			"Write",
		])
	},
})

export const Empty = meta.story({
	args: { items: [] },
	parameters: {
		docs: {
			description: {
				story:
					"Nothing collected yet. The sentence stands where the rows will be, so the field never collapses to an input floating alone.",
			},
		},
	},
})

export const Refused = meta.story({
	args: {
		isItemValid: (item: string) =>
			/^[A-Za-z_][A-Za-z0-9_-]*(\(.+\))?$/.test(item),
		invalidMessage: "Write a rule as Tool or Tool(specifier).",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A line the field cannot accept. It stays in the input, marked and explained, and the list is left as it was — nothing is silently dropped.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("Denied"), "not a rule!")
		await userEvent.click(canvas.getByRole("button", { name: "Add" }))

		await expect(args.onItemsChange).not.toHaveBeenCalled()
		await expect(canvas.getByRole("alert")).toBeVisible()
	},
})

export const Removing = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Every row carries its own way out, named after the line it removes, so a reader hearing the buttons one by one knows which is which.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Remove Bash" }))

		await expect(args.onItemsChange).toHaveBeenCalledWith(["Edit"])
	},
})

const ARTBOARD_LIST =
	"The input and every row on the frame of the artboard V1e text field, light and dark side by side: a `muted` fill, a 1px `input` outline and the `radius-control` corner. "

const framesIn = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLElement>("input, li"),
]

const inputsIn = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLInputElement>("input"),
]

const expectArtboardFrames = async (canvasElement: HTMLElement) => {
	for (const frame of framesIn(canvasElement)) {
		await expectFieldFrame(frame)
		await expectControlRadius(frame)
	}
}

export const ThemesAtRest = meta.story({
	globals: { theme_layout: "side-by-side" },
	args: { items: [] },
	parameters: {
		docs: { description: { story: `${ARTBOARD_LIST}Nothing listed yet.` } },
	},
	play: async ({ canvasElement }) => {
		await expect(inputsIn(canvasElement).length).toBe(2)
		await expectArtboardFrames(canvasElement)
	},
})

export const ThemesFilled = meta.story({
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: { description: { story: `${ARTBOARD_LIST}Holding two rows.` } },
	},
	play: async ({ canvasElement }) => {
		await expect(framesIn(canvasElement).length).toBe(6)
		await expectArtboardFrames(canvasElement)
	},
})

export const ThemesFocusVisible = meta.story({
	globals: { theme_layout: "side-by-side" },
	parameters: {
		pseudo: { focusVisible: "input" },
		docs: {
			description: {
				story: `${ARTBOARD_LIST}Keyboard focus keeps the existing \`ring\` outline and halo on the input.`,
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const input of inputsIn(canvasElement)) {
			input.focus()
			await expectFocusRing(input)
		}
	},
})

export const ThemesInvalid = meta.story({
	globals: { theme_layout: "side-by-side" },
	args: {
		isItemValid: () => false,
		invalidMessage: "Write a rule as Tool or Tool(specifier).",
	},
	parameters: {
		docs: {
			description: {
				story: `${ARTBOARD_LIST}Refused, the input keeps the existing \`destructive\` outline.`,
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		for (const input of inputsIn(canvasElement)) {
			await userEvent.type(input, "not a rule!{Enter}")
			await expectInvalidOutline(input)
		}
	},
})
