import { useState } from "react"
import { expect, fn, screen, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	HISTORY_DAYS,
	HISTORY_OLDEST_DATE,
	LONG_SENTENCE_DAYS,
} from "@workspace/ui/components/plugin-settings/history.fixtures"
import {
	HistoryPanel,
	type HistoryPanelProps,
} from "@workspace/ui/components/plugin-settings/history-panel"

const NarrowingHost = ({ onSearchChange, ...props }: HistoryPanelProps) => {
	const [text, setText] = useState("")

	return (
		<HistoryPanel
			{...props}
			days={text === "" ? props.days : []}
			onSearchChange={(next) => {
				setText(next)
				onSearchChange?.(next)
			}}
		/>
	)
}

const ROW_SELECTOR = "[data-slot='history-change']"

const firstRow = (canvasElement: HTMLElement) => {
	const row = canvasElement.querySelector(ROW_SELECTOR)
	if (!row) throw new Error("The timeline rendered no change row")
	return row as HTMLElement
}

const meta = preview.meta({
	title: "Settings/Plugins/HistoryPanel",
	component: HistoryPanel,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Everything that has ever changed in a bundle, read as a timeline rather than as a log: one section per day, one plain line per change, newest first. The panel is handed its days already grouped and already matched — it groups nothing and matches nothing, it renders what it is given and emits the search text so the host can narrow it. Each row is one line: who, what they changed, and when. Undo lives in a slot that is reserved on every row and only drawn under the pointer or under keyboard focus, so the list never moves and the control is never out of reach.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="flex h-[28rem] w-[622px] flex-col overflow-y-auto">
				<Story />
			</div>
		),
	],
	args: {
		days: HISTORY_DAYS,
		oldestDate: HISTORY_OLDEST_DATE,
		companionName: "Nest Keeper",
		onUndo: fn(),
		onSearchChange: fn(),
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Three days of a bundle both hands have written in. Check the shape first — a heading and a rule per day, then one row per change — then that a row with no second line sits shorter than its neighbours without an empty line inside it, and that the head sentence counts the changes, dates the oldest and says what undoing writes.",
			},
		},
	},
	play: async ({ canvas }) => {
		const days = canvas.getAllByRole("heading", { level: 3 })
		await expect(days.map((day) => day.textContent)).toEqual([
			"Today",
			"Yesterday",
			"19 February",
		])

		await expect(canvas.getAllByRole("listitem")).toHaveLength(6)
		await expect(
			canvas.getByText(/Lists 6 changes since 19 February 2026/),
		).toBeVisible()
		await expect(
			canvas.getByText("Switched the model to Claude Sonnet 4.5"),
		).toBeVisible()

		const time = canvas.getByText("09:42")
		await expect(time.tagName).toBe("TIME")
		await expect(time).toHaveAttribute("datetime", "2026-03-04T09:42:00Z")
	},
})

export const Retouched = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A run of retouches the host kept as one change rather than five near-identical rows. The number of goes closes the sentence at the sentence's own weight, so it reads as part of the line instead of a badge bolted onto it.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("Tightened the wording of the instructions"),
		).toHaveTextContent("(4 goes)")
	},
})

export const Undone = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A change a later one has already taken back. The row stays in the list — nothing is ever removed from a history — and says so with a muted note after the sentence. Its undo slot stays reserved but empty: there is nothing left to undo on this line.",
			},
		},
	},
	play: async ({ canvas }) => {
		const row = canvas
			.getAllByRole("listitem")
			.find((item) => item.textContent?.includes("twelve calls"))
		if (!row) throw new Error("The undone change is missing from the list")

		await expect(row).toHaveTextContent("Undone above")
		await expect(
			within(row).queryByRole("button", { name: /^Undo/ }),
		).toBeNull()
	},
})

export const HoveredRow = meta.story({
	parameters: {
		pseudo: { hover: `${ROW_SELECTOR}:first-child` },
		docs: {
			description: {
				story:
					"The row under the pointer, with the undo control drawn in the slot every row reserves for it. Check the tint by eye — it follows the row radius — and read the assertions for the invariant behind it: a row that shows the control and a row that never will are exactly the same height, so nothing below moves when the pointer arrives. `UndoByKeyboard` covers the same slot reached without a pointer, and is where the control being drawn is actually proven, since the test runner has no pointer to hover with.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = [...canvasElement.querySelectorAll(ROW_SELECTOR)]
		const reserved = rows.find((row) =>
			row.textContent?.includes("release-notes"),
		)
		const undone = rows.find((row) => row.textContent?.includes("twelve calls"))
		if (!reserved || !undone) throw new Error("The timeline lost a row")

		const undo = reserved.querySelector("button")
		if (!undo) throw new Error("The row reserved no undo control")

		await expect(getComputedStyle(undo).opacity).toBe("0")
		await expect(undone.querySelector("button")).toBeNull()
		await expect(reserved.getBoundingClientRect().height).toBe(
			undone.getBoundingClientRect().height,
		)
	},
})

export const UndoByKeyboard = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same undo control with no pointer anywhere near it. Tab reaches it on the first row, the row tints as if hovered, and the control is drawn — proof that hiding it is a matter of paint, not of removing it from the tab order or the accessibility tree. Its name carries the change it undoes, so a screen reader never hears six identical `Undo` buttons.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		await userEvent.tab()
		await userEvent.tab()

		const undo = canvasElement.querySelector<HTMLButtonElement>(
			`${ROW_SELECTOR} button`,
		)
		if (!undo) throw new Error("The first row is missing its undo control")

		await expect(undo).toHaveFocus()
		await expect(undo).toHaveAccessibleName(
			"Undo “Switched the model to Claude Sonnet 4.5”",
		)
		await expect(getComputedStyle(undo).opacity).toBe("1")
	},
})

export const Undoing = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The one action a row carries. It never acts on the press: the question names the change it was asked on, says what the undo writes, and says the undo can itself be undone. Only the second press reports it.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const undo = firstRow(canvasElement).querySelector("button")
		if (!undo) throw new Error("The first row is missing its undo control")

		await userEvent.click(undo)

		const question = await screen.findByRole("alertdialog")
		await expect(question).toHaveTextContent(
			"Undo “Switched the model to Claude Sonnet 4.5”?",
		)
		await expect(question).toHaveTextContent("you can undo it too")
		await expect(args.onUndo).not.toHaveBeenCalled()

		await userEvent.click(
			within(question).getByRole("button", { name: "Undo this change" }),
		)

		await expect(args.onUndo).toHaveBeenCalledWith(
			expect.objectContaining({ id: "change-6" }),
		)
	},
})

export const WithOpenCallback = meta.story({
	args: { onOpen: fn() },
	parameters: {
		docs: {
			description: {
				story:
					"The list wired to a host that has somewhere to send a reader. Each row becomes one button named after its own sentence, and the undo stays a sibling of that button rather than a button inside a button. Without the callback — every other story here — the rows are static text carrying no button role at all.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const row = canvas.getByRole("button", {
			name: "Switched the model to Claude Sonnet 4.5",
		})
		const undo = within(firstRow(canvasElement)).getByRole("button", {
			name: /^Undo/,
		})

		await expect(row.contains(undo)).toBe(false)

		await userEvent.click(row)
		await expect(args.onOpen).toHaveBeenCalledWith(
			expect.objectContaining({ id: "change-6" }),
		)
	},
})

export const LongContent = meta.story({
	args: { days: LONG_SENTENCE_DAYS },
	parameters: {
		docs: {
			description: {
				story:
					"A change nobody wrote to fit. The sentence is clamped to one line while the author name, the undo slot and the time hold their full width, so the trailing column never drifts and the panel never scrolls sideways.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const row = firstRow(canvasElement)

		await expect(within(row).getByText("11:30")).toBeVisible()
		await expect(within(row).getByText("Nest Keeper")).toBeVisible()
		await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.clientWidth,
		)
	},
})

export const SearchWithoutMatch = meta.story({
	render: (args) => <NarrowingHost {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"The search opened on a word the host matched nothing against. Opening it puts a field where the sentence was and moves focus into it; every keystroke is emitted so the host can narrow the days it hands back. With none left, the panel says nothing matches that text instead of falling back to the first-run empty state, which would read as a bundle nobody has ever touched.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Search the history" }),
		)

		const field = canvas.getByRole("textbox", { name: "Search the history" })
		await expect(field).toHaveFocus()

		await userEvent.type(field, "budget")
		await expect(args.onSearchChange).toHaveBeenLastCalledWith("budget")
		await expect(canvas.getByText("No change matches “budget”.")).toBeVisible()

		await userEvent.click(
			canvas.getByRole("button", { name: "Clear the search" }),
		)
		await expect(args.onSearchChange).toHaveBeenLastCalledWith("")
		await expect(canvas.queryByRole("textbox")).toBeNull()
	},
})

export const Empty = meta.story({
	args: { days: [], oldestDate: "" },
	parameters: {
		docs: {
			description: {
				story:
					"A bundle nobody has changed yet. One sentence and nothing else — no head row either, because there is no count to give and no date to date it from. `SearchWithoutMatch` covers the other way the list comes back empty.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("No changes yet.")).toBeVisible()
		await expect(canvas.queryAllByRole("listitem")).toHaveLength(0)
	},
})

export const Unreadable = meta.story({
	args: { days: [], oldestDate: "", haveFailedToLoad: true },
	parameters: {
		docs: {
			description: {
				story:
					"The read of this bundle's history came back refused. The panel says so instead of showing the empty state, so a lost history is never read as a bundle nobody has touched.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("Couldn't load the history. Reopen settings to retry."),
		).toBeVisible()
		await expect(canvas.queryAllByRole("listitem")).toHaveLength(0)
	},
})
