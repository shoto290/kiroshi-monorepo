import { useState } from "react"
import { expect, fn, screen, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL } from "@workspace/storybook/story-utils"
import {
	type BotModelOption,
	DEFAULT_BOT_OUTPUT_STYLE,
} from "@workspace/ui/components/bot-settings"
import {
	RuntimeFields,
	type RuntimeFieldsProps,
} from "@workspace/ui/components/bot-settings-dialog/runtime-fields"

const MODELS: BotModelOption[] = [
	{ label: "Nest Sonnet 4.5", value: "nest-sonnet-4-5" },
	{ label: "Nest Opus 4.1", value: "nest-opus-4-1" },
	{ label: "Nest Haiku 4.5", value: "nest-haiku-4-5" },
]

const RuntimeFieldsHost = (props: RuntimeFieldsProps) => {
	const [model, setModel] = useState(props.model)
	const [outputStyle, setOutputStyle] = useState(props.outputStyle)

	return (
		<RuntimeFields
			{...props}
			model={model}
			onModelChange={(next) => {
				setModel(next)
				props.onModelChange(next)
			}}
			onOutputStyleChange={(next) => {
				setOutputStyle(next)
				props.onOutputStyleChange?.(next)
			}}
			outputStyle={outputStyle}
		/>
	)
}

const meta = preview.meta({
	title: "Settings/Bot/RuntimeFields",
	component: RuntimeFields,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"What a companion runs on: the model behind it and the answer style it writes in. Both are pickers, never text, because neither is something a reader can type correctly: a mistyped model is a companion that never answers. What the companion is allowed to do is not here: that is the approvals panel next door. No field owns anything either: the model list comes from the host.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="flex w-full max-w-md flex-col gap-4">
				<Story />
			</div>
		),
	],
	args: {
		models: MODELS,
		model: "nest-sonnet-4-5",
		outputStyle: DEFAULT_BOT_OUTPUT_STYLE,
		onModelChange: fn(),
		onOutputStyleChange: fn(),
	},
	render: (args) => <RuntimeFieldsHost {...args} />,
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Knob story for both fields. Check that the labels sit above their controls at the same rhythm, that the model and answer style triggers share a height, and that the group needs no fieldset around it to read as one.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("combobox", { name: /Model/ }),
		).toHaveTextContent("Nest Sonnet 4.5")
		await expect(canvas.queryByRole("button", { name: /Folder/ })).toBeNull()
	},
})

export const Filled = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A configured companion: a model out of the host's list and an answer style already picked.",
			},
		},
	},
})

export const Concise = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The style a companion is given by default: short answers that lead with the result. The hint under the trigger is the picked style's own, so the reader reads what they chose rather than a sentence about the field.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("combobox", { name: /Answer style/ }),
		).toHaveTextContent("Concise")
		await expect(
			canvas.getByText("Short answers that lead with the result."),
		).toBeVisible()
	},
})

export const StandardAnswers = meta.story({
	args: { outputStyle: "default" },
	parameters: {
		docs: {
			description: {
				story:
					"The agent’s standard answers. The value the host stores raw is `default`, and the reader never sees it — the trigger reads `Standard` and the hint changes with it. Check that picking reports the raw value rather than the label.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const style = canvas.getByRole("combobox", { name: /Answer style/ })

		await expect(style).toHaveTextContent("Standard")

		await userEvent.click(style)
		await userEvent.click(
			await screen.findByRole("option", { name: "Concise" }),
		)

		await waitFor(async () => {
			await expect(screen.queryByRole("listbox")).toBeNull()
		}, FRAME_POLL)

		await expect(args.onOutputStyleChange).toHaveBeenCalledWith("Concise")
		await expect(style).toHaveTextContent("Concise")
	},
})

export const Empty = meta.story({
	args: { model: "" },
	parameters: {
		docs: {
			description: {
				story:
					"A companion that has just been created. The model trigger holds its size and shows a muted instruction rather than an error: nothing is wrong yet, the reader simply has not answered. Check that the placeholder reads as a prompt to act (`Choose a model`).",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Choose a model")).toBeVisible()
		await expect(canvas.queryByRole("button", { name: /Folder/ })).toBeNull()
	},
})

export const PickingAModel = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The list open over the trigger. Every option gets a fixed indicator column, so the checked one is marked without the labels shifting, and the popup matches the trigger's width and scrolls inside the space available. Check that the choice reports the option's `value`, not its label, and that the trigger takes the new label immediately.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("combobox", { name: /Model/ }))
		await userEvent.click(
			await screen.findByRole("option", { name: "Nest Opus 4.1" }),
		)

		await waitFor(async () => {
			await expect(screen.queryByRole("listbox")).toBeNull()
		}, FRAME_POLL)

		await expect(args.onModelChange).toHaveBeenCalledWith("nest-opus-4-1")
		await expect(
			canvas.getByRole("combobox", { name: /Model/ }),
		).toHaveTextContent("Nest Opus 4.1")
	},
})

export const NoModels = meta.story({
	args: { models: [], model: "" },
	parameters: {
		docs: {
			description: {
				story:
					"The host has no models to offer — the transport is down, or none is installed yet. The trigger still stands and still opens, showing an empty popup rather than a broken one, and the placeholder keeps the row honest. Reach for this to check that a missing list never leaves the group half-drawn.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Choose a model")).toBeVisible()
	},
})
