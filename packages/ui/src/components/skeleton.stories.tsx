// Call site: packages/ui/src/components/plugin-settings/applications-catalogue.tsx
// line 188 for the bar and line 196 for the mark

import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { Skeleton } from "@workspace/ui/components/ui/skeleton"

const MARK_CLASS =
	"size-7 shrink-0 rounded-md bg-border motion-reduce:animate-none"

const BAR_CLASS = "rounded-sm bg-border motion-reduce:animate-none"

const FAINT_BAR_CLASS = "rounded-sm bg-border/60 motion-reduce:animate-none"

const meta = preview.meta({
	title: "Feedback/Skeleton",
	component: Skeleton,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The pulsing box the registry ships to stand in for content that is still on its way. It is a shape and nothing else: no text, no role, no size of its own — every dimension, every corner and every tint come from the caller, and the caller is also the one that keeps it out of the accessible tree. In this app it is reached in one place, the applications catalogue while the registries answer, where it takes exactly two shapes.",
			},
		},
	},
})

export const Loading = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The two shapes the catalogue gives the primitive: the square mark standing in for an application icon, and the bar standing in for a line of its text, in the solid tint of a title and the faint one of a description. Check that each shape holds the size it was given, that the faint bar reads as secondary without becoming invisible, and that both stop pulsing under reduced motion — the browser this story is tested in asks for it, so the assertion reads the stopped state. The composed wait, three rows out of the accessible tree, is proven on the real component in applications-catalogue.stories.tsx > CatalogueLoading.",
			},
		},
	},
	render: () => (
		<div className="flex w-80 items-center gap-2.5">
			<Skeleton className={MARK_CLASS} />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Skeleton className={`h-2.75 w-33 ${BAR_CLASS}`} />
				<Skeleton className={`h-2.25 w-51.5 ${FAINT_BAR_CLASS}`} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const [mark, title, description] = slotsIn(canvasElement, "skeleton")

		await expect(mark.getBoundingClientRect().height).toBe(28)
		await expect(mark.getBoundingClientRect().width).toBe(28)
		await expect(title.getBoundingClientRect().height).toBe(11)
		await expect(description.getBoundingClientRect().height).toBe(9)
		await expect(getComputedStyle(title).backgroundColor).not.toBe(
			getComputedStyle(description).backgroundColor,
		)
		await expect(getComputedStyle(mark).animationName).toBe("none")
	},
})
