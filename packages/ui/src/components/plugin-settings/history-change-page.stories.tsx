import { expect, fn, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { A11Y_CONTRAST_AWAITING_DESIGN_DECISION } from "@workspace/storybook/story-utils"
import {
	MANY_CHANGE_FILES,
	ONE_CHANGE_FILE,
} from "@workspace/ui/components/plugin-settings/history.fixtures"
import { HistoryChangePage } from "@workspace/ui/components/plugin-settings/history-change-page"

const DEEP_PATH = "skills/release-notes/references/wording/house-style.md"

const meta = preview.meta({
	title: "Settings/Plugins/HistoryChangePage",
	component: HistoryChangePage,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"One change from the history, opened as a pushed page inside the settings dialog it was opened from. The rail stops being the dialog's groups and becomes the files that change touched, with Back above them; the panel is the diff of whichever file is chosen, under the change's own title, author and date. The foot pairs Undo with the sentence that says what it puts back and over how many files, so nobody has to guess the blast radius before pressing it. The page draws nothing it is not handed: the files, the reading flag and the failure flag all come from the host.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="flex h-[34rem] w-[52rem] overflow-hidden rounded-2xl border border-border">
				<Story />
			</div>
		),
	],
	args: {
		title: "Rewrote the instructions",
		author: "Nest Keeper",
		date: "Today, 09:42",
		reason:
			"The notes were listing pull requests instead of what actually changed.",
		files: ONE_CHANGE_FILE,
		onBack: fn(),
		onUndo: fn(),
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A change that touched one file, which is the shape most changes take. Check that the rail reads Back then that single file already chosen, that the header carries the title above who and when, that the file heading names the whole path and how much of it moved, and that the foot sentence counts one file rather than a plural. Pick `LongContent` for a change spread over several files.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("button", { name: "History" })).toBeVisible()

		await expect(
			canvas.getByRole("tab", { name: "AGENTS.md" }),
		).toHaveAttribute("aria-selected", "true")

		await expect(
			canvas.getByRole("heading", { name: "Rewrote the instructions" }),
		).toBeVisible()
		await expect(canvas.getByText("Nest Keeper · Today, 09:42")).toBeVisible()
		await expect(canvas.getByText("1 line added, 1 line removed")).toBeVisible()
		await expect(
			canvas.getByText(/across 1 file, and writes that as a new change/),
		).toBeVisible()
	},
})

export const LongContent = meta.story({
	args: { files: MANY_CHANGE_FILES },
	parameters: {
		docs: {
			description: {
				story:
					"A change spread over four files, one of them nested deep enough that its path outgrows the rail. Reach for this to check the two things a narrow rail owes a reader: the row drops its leading folders for an ellipsis and keeps the file name whole, and the whole path is still readable in a tooltip on that row. Check too that the first file is chosen on open and that the arrow keys walk the rail without the pointer.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getAllByRole("tab")).toHaveLength(4)
		await expect(
			canvas.getByRole("tab", { name: "AGENTS.md" }),
		).toHaveAttribute("aria-selected", "true")

		const deep = await waitFor(() =>
			canvas.getByRole("tab", { name: "…/house-style.md" }),
		)

		await userEvent.tab()
		await userEvent.tab()
		await userEvent.keyboard("{ArrowDown}{Enter}")

		await expect(deep).toHaveFocus()
		await expect(deep).toHaveAttribute("aria-selected", "true")
		await expect(
			within(canvas.getByRole("tabpanel")).getByText(DEEP_PATH),
		).toBeVisible()

		await userEvent.hover(deep)
		await expect(
			await within(document.body).findByRole("tooltip"),
		).toHaveTextContent(DEEP_PATH)
	},
})

export const Loading = meta.story({
	args: { files: [], areFilesReading: true },
	parameters: {
		docs: {
			description: {
				story:
					"The moment between opening a change and having its files. Check that the diff's place says it is being read rather than sitting blank, that the rail still offers Back so nobody is stranded on a page with nothing on it, and that the foot is already there rather than appearing late.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText("Loading changes…")).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "History" }))
		await expect(args.onBack).toHaveBeenCalledTimes(1)
	},
})

export const Error = meta.story({
	args: { files: [], haveFilesFailedToRead: true },
	parameters: {
		docs: {
			description: {
				story:
					"The host could not read the files of this change. Check that the failure is said in the diff's place rather than swallowed into an empty panel, and that Back is still the way out. Pick `Loading` for the read that has not answered yet — this one is the read that answered badly.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(
			canvas.getByText(/Couldn't read the files of this change/),
		).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "History" }))
		await expect(args.onBack).toHaveBeenCalledTimes(1)
	},
})

export const Retouched = meta.story({
	args: {
		title: "Tightened the wording of the instructions",
		reason: "Four passes over the same paragraph, kept as one change.",
		retouchCount: 4,
		files: MANY_CHANGE_FILES,
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A grouped run: four goes at the same paragraph, folded into one change. Check that the meta line says so in the very wording the list uses, so the same run reads the same on both surfaces, and that the foot still counts files rather than goes. Pick `Default` for a single edit with no run behind it.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		await expect(
			canvas.getByText("Nest Keeper · Today, 09:42 · (4 goes)"),
		).toBeVisible()

		await userEvent.click(
			canvas.getByRole("button", { name: "Undo this change" }),
		)

		await expect(
			await within(document.body).findByRole("alertdialog"),
		).toHaveAccessibleName("Undo “Tightened the wording of the instructions”?")
	},
})
