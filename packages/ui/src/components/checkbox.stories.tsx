import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row } from "@workspace/storybook/story-utils"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"

const meta = preview.meta({
	title: "Forms/Checkbox",
	component: Checkbox,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					'The checkbox as the shadcn registry ships it, on the Base UI root: a span carrying `role="checkbox"` beside a hidden input, so a `<label for>` still owns the hit area and the name. Reach for it whenever a row can hold more than one answer; `RadioGroup` is the control for one answer out of a set.',
			},
		},
	},
	args: { "aria-label": "Send a summary", onCheckedChange: fn() },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The resting, unchecked control and the press that ticks it. Check that the box fills rather than only outlining once ticked — the mark and the fill both have to carry the state, because the tick alone disappears against a dark surface.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const control = canvas.getByRole("checkbox")

		await expect(control).toHaveAttribute("aria-checked", "false")
		await userEvent.click(control)
		await expect(args.onCheckedChange).toHaveBeenCalledWith(
			true,
			expect.anything(),
		)
	},
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The matrix a reviewer reads state by state: unchecked, checked, and both disabled ends. Check that the checked control announces `aria-checked` rather than relying on the fill alone, and that a disabled one still says which way it is set — dimming must not make on and off look alike.",
			},
		},
	},
	render: () => (
		<Row>
			<Checkbox aria-label="Unchecked" />
			<Checkbox aria-label="Checked" defaultChecked />
			<Checkbox aria-label="Disabled unchecked" disabled />
			<Checkbox aria-label="Disabled checked" defaultChecked disabled />
		</Row>
	),
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("checkbox", { name: "Checked" }),
		).toHaveAttribute("aria-checked", "true")
		await expect(
			canvas.getByRole("checkbox", { name: "Disabled checked" }),
		).toHaveAttribute("aria-disabled", "true")
	},
})

export const WithLabel = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The shape every real call site takes: a `<label for>` beside the control, which is what gives the box its accessible name and widens the hit area to the whole row. Check that pressing the words ticks the box, and that Tab reaches the box and draws a ring on it.",
			},
		},
	},
	render: () => (
		<label
			className="flex items-center gap-3 text-foreground text-sm"
			htmlFor="checkbox-summary"
		>
			<Checkbox id="checkbox-summary" />
			Send a summary after every run
		</label>
	),
	play: async ({ canvas, userEvent }) => {
		const control = canvas.getByRole("checkbox", {
			name: "Send a summary after every run",
		})

		await userEvent.tab()
		await expect(control).toHaveFocus()
		await expect(getComputedStyle(control).boxShadow).not.toBe("none")

		await userEvent.click(canvas.getByText("Send a summary after every run"))
		await expect(control).toHaveAttribute("aria-checked", "true")
	},
})

export const OnDarkSurface = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The four states on the dark surface. Check that the tick still reads against the filled box and that the empty box is still visible against the background — a box that disappears in the dark is a control nobody finds.",
			},
		},
	},
	render: () => (
		<Row>
			<Checkbox aria-label="Unchecked" />
			<Checkbox aria-label="Checked" defaultChecked />
			<Checkbox aria-label="Disabled unchecked" disabled />
			<Checkbox aria-label="Disabled checked" defaultChecked disabled />
		</Row>
	),
})
