// No call site renders this today: its only two consumers, SidebarSeparator at
// packages/ui/src/components/ui/sidebar.tsx line 362 and ItemSeparator at
// packages/ui/src/components/ui/item.tsx line 28, are themselves rendered by nothing.

import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { Separator } from "@workspace/ui/components/ui/separator"

const PANEL = "flex w-72 flex-col gap-3 rounded-xl border border-border p-4"

const LINE = "text-muted-foreground text-sm"

const meta = preview.meta({
	title: "Primitives/Separator",
	component: Separator,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The one-pixel rule the registry ships on the Base UI separator: a border-tinted line that takes its thickness from the axis it is given and its length from the parent that holds it. It carries the `separator` role, so it is announced as a division rather than read as decoration. Nothing in this app renders it today — both of its consumers, the sidebar separator and the item separator, are themselves unreached — so the stories below stand it up on its own.",
			},
		},
	},
})

export const Horizontal = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The default axis, dividing two stacked groups. Check that the line is exactly one pixel tall at any zoom and that it takes the full width of its parent rather than a width of its own — the length is always the parent's business.",
			},
		},
	},
	render: () => (
		<div className={PANEL}>
			<p className={LINE}>Everything the space holds</p>
			<Separator />
			<p className={LINE}>Everything it archived</p>
		</div>
	),
	play: async ({ canvasElement }) => {
		const separator = slotIn(canvasElement, "separator")
		const panel = separator.parentElement as HTMLElement

		await expect(separator.getBoundingClientRect().height).toBe(1)
		await expect(separator.getBoundingClientRect().width).toBe(
			panel.clientWidth - 32,
		)
	},
})
