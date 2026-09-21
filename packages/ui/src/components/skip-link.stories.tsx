import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SkipLink } from "@workspace/ui/components/skip-link"

const TARGET_ID = "skip-link-story-main"

const LABEL = "Skip to the conversation"

const CUSTOM_LABEL = "Skip to the main content"

const meta = preview.meta({
	title: "Navigation/SkipLink",
	component: SkipLink,
	args: {
		targetId: TARGET_ID,
	},
	render: (args) => (
		<>
			<SkipLink {...args} />
			<button className="m-4" type="button">
				Sidebar control
			</button>
			<main className="p-4 text-sm" id={TARGET_ID} tabIndex={-1}>
				The conversation.
			</main>
		</>
	),
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The first stop of the keyboard in the shell. It stays out of sight until Tab reaches it, then shows over the top leading corner with the focus ring, and Enter moves focus straight into the main region that holds the conversation, past every sidebar control. The shell renders it itself and threads the region id to the content card, so the app composes nothing for it.",
			},
		},
	},
})

export const Hidden = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The resting state. Check that nothing shows before the keyboard reaches the link, while it stays in the accessibility tree under its verb-first name.",
			},
		},
	},
	play: async ({ canvas }) => {
		const link = canvas.getByRole("link", { name: LABEL })

		await expect(link).not.toHaveFocus()
		await expect(link.getBoundingClientRect().width).toBeLessThanOrEqual(1)
	},
})

export const Focused = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same link once Tab lands on it. Check that it is the first thing focused, that it shows with the focus ring, and that Enter puts focus into the main region rather than on the next sidebar control.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const link = canvas.getByRole("link", { name: LABEL })

		await userEvent.tab()
		await expect(link).toHaveFocus()
		await expect(link.getBoundingClientRect().width).toBeGreaterThan(1)
		await expect(link).toBeVisible()

		await userEvent.keyboard("{Enter}")
		await expect(canvas.getByRole("main")).toHaveFocus()
	},
})

export const CustomLabel = meta.story({
	args: {
		label: CUSTOM_LABEL,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The link on a page whose main region is not a conversation, carrying its own wording instead of the shell's. Check that Tab lands on it under that name and that Enter still moves focus into the main region.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const link = canvas.getByRole("link", { name: CUSTOM_LABEL })

		await expect(canvas.queryByRole("link", { name: LABEL })).toBeNull()
		await userEvent.tab()
		await expect(link).toHaveFocus()

		await userEvent.keyboard("{Enter}")
		await expect(canvas.getByRole("main")).toHaveFocus()
	},
})
