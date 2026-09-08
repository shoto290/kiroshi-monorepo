import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	RadioGroup,
	RadioGroupItem,
} from "@workspace/ui/components/ui/radio-group"

const CHOICES = ["Now", "Next week", "Never"]

const meta = preview.meta({
	title: "Forms/RadioGroup",
	component: RadioGroup,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"One answer out of a set, as the shadcn registry ships it. The group owns the value and the arrow keys walk it, so the whole set is a single tab stop. Reach for `Checkbox` when a reader may pick more than one.",
			},
		},
	},
	args: { onValueChange: fn() },
})

type ChoicesProps = { group: string; disabled?: boolean }

const idOf = (group: string, choice: string) =>
	`${group}-${choice.replace(/\s/g, "-").toLowerCase()}`

const Choices = ({ group, disabled }: ChoicesProps) => (
	<>
		{CHOICES.map((choice) => (
			<label
				className="flex items-center gap-3 text-foreground text-sm"
				htmlFor={idOf(group, choice)}
				key={choice}
			>
				<RadioGroupItem
					disabled={disabled}
					id={idOf(group, choice)}
					value={choice}
				/>
				{choice}
			</label>
		))}
	</>
)

export const Default = meta.story({
	render: (args) => (
		<RadioGroup {...args} aria-label="Ship the release">
			<Choices group="ship" />
		</RadioGroup>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The nominal set: three answers, none picked yet. Check that picking one clears the one before it, and that the picked item reads as checked to a screen reader rather than only wearing the filled dot.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("radio", { name: "Next week" }))

		await expect(args.onValueChange).toHaveBeenCalledWith(
			"Next week",
			expect.anything(),
		)
		await expect(
			canvas.getByRole("radio", { name: "Next week" }),
		).toHaveAttribute("aria-checked", "true")
		await expect(canvas.getByRole("radio", { name: "Now" })).toHaveAttribute(
			"aria-checked",
			"false",
		)
	},
})

export const States = meta.story({
	render: () => (
		<div className="flex gap-8">
			<RadioGroup aria-label="Enabled" defaultValue="Next week">
				<Choices group="enabled" />
			</RadioGroup>
			<RadioGroup aria-label="Disabled" defaultValue="Next week">
				<Choices disabled group="disabled" />
			</RadioGroup>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Unselected, selected and disabled side by side, the second group disabled item by item. Check that the selected item keeps its dot once dimmed — a disabled group must still say what it was set to — and that a disabled item takes no press.",
			},
		},
	},
	play: async ({ canvas }) => {
		const [enabled, disabled] = canvas.getAllByRole("radiogroup")

		await expect(
			within(enabled).getByRole("radio", { name: "Next week" }),
		).toHaveAttribute("aria-checked", "true")
		await expect(
			within(disabled).getByRole("radio", { name: "Now" }),
		).toHaveAttribute("aria-disabled", "true")
	},
})

export const KeyboardWalk = meta.story({
	render: (args) => (
		<RadioGroup {...args} aria-label="Ship the release" defaultValue="Now">
			<Choices group="walk" />
		</RadioGroup>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The keyboard path: one Tab reaches the group, the arrows move the answer. Check that the ring lands on the item the arrows moved to rather than on the group, so a reader can see where they are before pressing anything.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.tab()
		await userEvent.keyboard("{ArrowDown}")

		const moved = canvas.getByRole("radio", { name: "Next week" })

		await expect(moved).toHaveFocus()
		await expect(moved).toHaveAttribute("aria-checked", "true")
		await expect(getComputedStyle(moved).boxShadow).not.toBe("none")
	},
})

export const OnDarkSurface = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The set on the dark surface. Check that the dot inside the picked item still reads against its fill and that the two resting rings stay visible — the picked item must be told apart from the others without turning up the brightness.",
			},
		},
	},
	render: () => (
		<RadioGroup aria-label="Ship the release" defaultValue="Next week">
			<Choices group="dark" />
		</RadioGroup>
	),
})
