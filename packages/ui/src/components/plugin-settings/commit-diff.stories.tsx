import { expect, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { CommitDiff } from "@workspace/ui/components/plugin-settings/commit-diff"
import {
	ADDED_SKILL_PATCH,
	MODEL_PATCH,
	UNREADABLE_PATCH,
	WIDE_LINE_PATCH,
} from "@workspace/ui/components/plugin-settings/history.fixtures"

const patchElement = (canvasElement: HTMLElement) => {
	const patch = canvasElement.querySelector("diffs-container")
	if (!patch) throw new Error("The diff was never rendered as a patch")
	return patch
}

const readPatch = async (canvasElement: HTMLElement) =>
	await waitFor(() => {
		const text = patchElement(canvasElement).shadowRoot?.textContent ?? ""
		if (text.trim() === "") throw new Error("The patch is still being read")
		return text
	})

const meta = preview.meta({
	title: "Settings/Plugins/CommitDiff",
	component: CommitDiff,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"What one change wrote, rendered from the raw patch the host hands over. One column, the old line above the new one, each side told apart by its colour rather than by counting leading characters. A payload that is not a patch is shown as plain text rather than as an empty frame, so a reader always sees whatever the host had to give.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="w-[622px] overflow-x-auto p-5">
				<Story />
			</div>
		),
	],
	args: { patch: MODEL_PATCH },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A patch that edits one file. Check that both sides are drawn and that the header carries the path the change was written to.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const patch = await readPatch(canvasElement)

		await expect(patch).toContain('"model": "sonnet-4-5",')
		await expect(patch).toContain('"model": "haiku-4-5",')
		await expect(patch).toContain("bot.json")
	},
})

export const AddedFile = meta.story({
	args: { patch: ADDED_SKILL_PATCH },
	parameters: {
		docs: {
			description: {
				story:
					"A patch that adds a file. There is no old side to read against, so every line is an addition and the header carries the path the file was written to.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const patch = await readPatch(canvasElement)

		await expect(patch).toContain("skills/release-notes/SKILL.md")
		await expect(patch).toContain("One line per change, in the past tense.")
	},
})

export const LongContent = meta.story({
	args: { patch: WIDE_LINE_PATCH },
	parameters: {
		docs: {
			description: {
				story:
					"A patch carrying a line far wider than the panel. The line wraps instead of running off the edge, so nothing sends the surface around it sideways.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await readPatch(canvasElement)

		const patch = patchElement(canvasElement)
		await expect(patch.scrollWidth).toBeLessThanOrEqual(patch.clientWidth)
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)
	},
})

export const Unreadable = meta.story({
	args: { patch: UNREADABLE_PATCH },
	parameters: {
		docs: {
			description: {
				story:
					"A payload that is not a patch at all. Rather than an empty frame, it falls back to whatever the host handed over as plain text, so a reader still sees the note behind the change.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText(/restored from a snapshot/)).toBeVisible()
		await expect(canvasElement.querySelector("diffs-container")).toBeNull()
	},
})
