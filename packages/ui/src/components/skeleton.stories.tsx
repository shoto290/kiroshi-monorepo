// Call site: packages/ui/src/components/plugin-settings/applications-catalogue.tsx line 188

import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { Skeleton } from "@workspace/ui/components/ui/skeleton"
import { cn } from "@workspace/ui/lib/utils"

const ROW_LIST_CLASS = "flex list-none flex-col gap-2.25 p-0"

const ROW_SHELL_CLASS =
	"flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-border px-3 py-2"

const ROW_SKELETONS = ["one", "two", "three"]

type SkeletonBarProps = {
	className: string
	isFaint?: boolean
}

const SkeletonBar = ({ className, isFaint = false }: SkeletonBarProps) => (
	<Skeleton
		className={cn(
			"rounded-sm motion-reduce:animate-none",
			isFaint ? "bg-border/60" : "bg-border",
			className,
		)}
	/>
)

const SkeletonMark = () => (
	<Skeleton className="size-7 shrink-0 rounded-md bg-border motion-reduce:animate-none" />
)

const CatalogueRowSkeletons = () => (
	<ul aria-hidden="true" className={ROW_LIST_CLASS}>
		{ROW_SKELETONS.map((rank) => (
			<li className="flex" data-slot="catalogue-row-skeleton" key={rank}>
				<div className={ROW_SHELL_CLASS}>
					<SkeletonMark />
					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<SkeletonBar className="h-2.75 w-33" />
						<SkeletonBar className="h-2.25 w-51.5" isFaint />
						<SkeletonBar className="h-2.25 w-39.5" isFaint />
					</div>
					<SkeletonBar className="h-2.25 w-24.5 shrink-0" isFaint />
				</div>
			</li>
		))}
	</ul>
)

const meta = preview.meta({
	title: "Feedback/Skeleton",
	component: Skeleton,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The pulsing box the registry ships to stand in for content that is still on its way. It is a shape and nothing else: no text, no role, no size of its own — the caller gives it every dimension and every tint. In this app it is reached in one place, the rows the applications catalogue draws while the registries answer, so the story below is that composition rather than a lone box.",
			},
		},
	},
	decorators: [(Story) => <div className="w-[36rem]">{Story()}</div>],
})

export const Loading = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The catalogue waiting on the registries: three rows drawn at the height and the rhythm the real rows take, so nothing jumps when the answer lands. Check that the whole list is out of the accessible tree — it is `aria-hidden`, the wait is announced elsewhere — that the bars sit on the border token rather than on a surface one, and that each of them stops pulsing under reduced motion instead of being the only thing moving on screen — the browser this story is tested in asks for reduced motion, so the assertion reads the stopped state.",
			},
		},
	},
	render: () => <CatalogueRowSkeletons />,
	play: async ({ canvasElement }) => {
		const rows = slotsIn(canvasElement, "catalogue-row-skeleton")
		const [list] = Array.from(canvasElement.querySelectorAll("ul"))
		const [mark] = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('[data-slot="skeleton"]'),
		)

		await expect(rows).toHaveLength(3)
		await expect(list).toHaveAttribute("aria-hidden", "true")
		await expect(mark.getBoundingClientRect().height).toBe(28)
		await expect(getComputedStyle(mark).animationName).toBe("none")
	},
})
