import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { JoinedSpaceFields } from "@workspace/ui/components/space-settings-dialog/joined-space-fields"

const meta = preview.meta({
	title: "Settings/Space/JoinedSpaceFields",
	component: JoinedSpaceFields,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The Space entry of a space joined from another Kiroshi: its name and the host it lives on, both read-only because the host owns them. The host carries the reason as its hint, so a reader looking for where to rename it is told where. No colour, no share link, nothing to move between machines. Pick `SpaceFields` for a space this machine owns.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="w-full max-w-md">
				<Story />
			</div>
		),
	],
	args: {
		name: "Northwind",
		host: "http://192.168.1.24:45367",
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Name and Host on a joined space. Check that neither takes an edit, that both still take focus so the host can be selected and copied, and that the hint under Host is read as its description.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const name = canvas.getByLabelText("Name")
		const host = canvas.getByLabelText("Host")

		await userEvent.type(name, "!")
		await expect(name).toHaveValue("Northwind")
		await expect(name).toHaveFocus()
		await expect(host).toHaveAttribute("readonly")
		await expect(host).toHaveAccessibleDescription(
			"This space lives on another Kiroshi. Its name is set there.",
		)
	},
})
