import { useState } from "react"
import { expect, fireEvent, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
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
	"onRequestChange" | "onValueChange" | "request"
>

const PickerHost = ({
	companions,
	value: initialValue,
	...props
}: PickerHostProps) => {
	const [value, setValue] = useState(initialValue)
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
		onRequestSubmit: fn(),
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
	play: async ({ canvas, canvasElement, userEvent }) => {
		const add = canvas.getByRole("button", { name: "Add Scout" })
		const card = slotIn(canvasElement, "onboarding-card")
		const field = canvas.getByLabelText(
			"Or say what you need in your own words",
		)
		const label = add.firstElementChild as HTMLElement

		await expect(add).toBeVisible()
		await expect(getComputedStyle(card).borderRadius).toBe("20px")
		await expect(getComputedStyle(field).borderRadius).toBe("12px")
		await expect(getComputedStyle(add).borderRadius).toBe("12px")
		await expect(getComputedStyle(label).fontSize).toBe("13px")
		await expect(getComputedStyle(label).color).toBe(
			getComputedStyle(card).getPropertyValue("--primary-foreground").trim(),
		)

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

export const NothingSelected = meta.story({
	args: { value: "" },
	parameters: {
		docs: {
			description: {
				story:
					"The reader wants none of the three and says so in their own words. Check that no primary exit is drawn while nobody is selected, since it would have no name to carry, that Skip for now is still reachable, and that pressing Enter in the field reports what was typed rather than losing it.",
			},
		},
	},
	render: (args) => <PickerHost {...args} />,
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.queryByRole("button", { name: /^Add/ })).toBeNull()

		const request = canvas.getByLabelText(
			"Or say what you need in your own words",
		)

		await userEvent.type(request, "Someone who drafts my emails")

		fireEvent.keyDown(request, { key: "Enter", isComposing: true })
		await expect(args.onRequestSubmit).not.toHaveBeenCalled()

		await userEvent.keyboard("{Enter}")
		await expect(args.onRequestSubmit).toHaveBeenCalledWith(
			"Someone who drafts my emails",
		)
	},
})

export const Disabled = meta.story({
	args: { disabled: true },
	parameters: {
		docs: {
			description: {
				story:
					"The picker while the app is answering the companion already asked for. Check that the options wear the primitive's own disabled treatment and refuse a new selection, that the own-words field takes no typing, and that the copy stays readable rather than dimming with the controls.",
			},
		},
	},
	render: (args) => <PickerHost {...args} />,
	play: async ({ canvas, userEvent }) => {
		const ledger = canvas.getByRole("radio", { name: /Ledger/ })
		const request = canvas.getByLabelText(
			"Or say what you need in your own words",
		)

		const option = ledger.closest(
			'[data-slot="onboarding-option"]',
		) as HTMLElement
		const name = canvas.getByText("Ledger, who keeps things in order")

		await expect(request).toBeDisabled()
		await expect(getComputedStyle(option).cursor).toBe("default")
		await expect(getComputedStyle(name).color).toBe(
			getComputedStyle(option).getPropertyValue("--foreground").trim(),
		)
		await expect(getComputedStyle(name).opacity).toBe("1")

		ledger.focus()
		await userEvent.keyboard("{ArrowDown}")
		await expect(ledger).not.toBeChecked()

		request.focus()
		await userEvent.keyboard("Someone else")
		await expect(request).toHaveValue("")
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
