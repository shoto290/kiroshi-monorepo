import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	type OnboardingCompanion,
	OnboardingPickerCard,
	type OnboardingPickerCardProps,
} from "@workspace/ui/components/onboarding-picker-card"

const COMPANIONS: OnboardingCompanion[] = [
	{
		id: "scout",
		name: "Scout",
		role: "who looks things up",
		description: "Reads long pages and reports back short.",
	},
	{
		id: "ledger",
		name: "Ledger",
		role: "who keeps things in order",
		description: "Watches your files and says what changed.",
	},
	{
		id: "maker",
		name: "Maker",
		role: "who writes code",
		description: "Edits the folders you point it at.",
	},
]

const LONG_COMPANIONS: OnboardingCompanion[] = COMPANIONS.map((companion) => ({
	...companion,
	role: `${companion.role} and stays on it for as long as the answer takes`,
	description: `${companion.description} It follows every page it is handed, keeps what matters and drops the rest, then says what it found in the fewest words it can.`,
}))

type PickerHostProps = Omit<
	OnboardingPickerCardProps,
	"onRequestChange" | "onValueChange" | "request" | "value"
>

const PickerHost = ({ companions, ...props }: PickerHostProps) => {
	const [value, setValue] = useState(companions[0]?.id ?? "")
	const [request, setRequest] = useState("")

	return (
		<OnboardingPickerCard
			{...props}
			companions={companions}
			onRequestChange={setRequest}
			onValueChange={setValue}
			request={request}
			value={value}
		/>
	)
}

const meta = preview.meta({
	title: "Conversation/Onboarding/OnboardingPickerCard",
	component: OnboardingPickerCard,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The last step of onboarding: three suggested companions as a single-selection radio group, plus a field for the reader who wants something else. The primary exit names whoever is selected, so a reader never adds a companion they did not read.",
			},
		},
	},
	args: {
		companions: COMPANIONS,
		value: COMPANIONS[0].id,
		onValueChange: fn(),
		request: "",
		onRequestChange: fn(),
		onAdd: fn(),
		onSkip: fn(),
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The three suggestions, the first one selected. Check that the selected row carries the foreground border and the secondary fill while the others stay on the background, that the arrow keys walk the group as one tab stop, that the primary exit renames itself after whoever is selected, and that the free text field is reached after the group. Pick `LongContent` for descriptions that wrap.",
			},
		},
	},
	render: (args) => <PickerHost {...args} />,
	play: async ({ canvas, userEvent }) => {
		await expect(
			canvas.getByRole("button", { name: "Add Scout" }),
		).toBeVisible()

		await userEvent.tab()
		await expect(canvas.getByRole("radio", { name: /Scout/ })).toHaveFocus()

		await userEvent.keyboard("{ArrowDown}")
		await expect(canvas.getByRole("radio", { name: /Ledger/ })).toBeChecked()
		await expect(
			canvas.getByRole("button", { name: "Add Ledger" }),
		).toBeVisible()

		await userEvent.tab()
		await expect(
			canvas.getByLabelText("Or say what you need in your own words"),
		).toHaveFocus()
	},
})

export const LongContent = meta.story({
	args: { companions: LONG_COMPANIONS },
	parameters: {
		docs: {
			description: {
				story:
					"Roles and descriptions long enough to run to three lines, in a container squeezed under the card's measured width. Check that every row grows taller rather than wider, that the radio mark stays on the first line of its option, and that the action row wraps rather than pushing the card open.",
			},
		},
	},
	render: (args) => (
		<div className="w-80 max-w-full">
			<PickerHost {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)
	},
})
