import type { VariantProps } from "class-variance-authority"
import { expect, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { listExhaustively } from "@workspace/storybook/story-utils"
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	type tabsListVariants,
} from "@workspace/ui/components/ui/tabs"

type TabsListVariant = NonNullable<
	VariantProps<typeof tabsListVariants>["variant"]
>

const TABS_LIST_VARIANTS = listExhaustively<TabsListVariant>({
	default: true,
	line: true,
})

const LONG_LABEL =
	"Everything this bot was asked to do since the beginning of the week"

const meta = preview.meta({
	title: "Navigation/Tabs",
	component: Tabs,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The tab bar as the shadcn registry ships it, on the Base UI root: the list is one tab stop, the arrows walk it, and `activateOnFocus` says whether walking also opens. Reach for it whenever one region has to hold several panels a reader switches between.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Three panels behind one list, the shape every call site takes. Check that only the open panel is in the accessible tree and that the active tab reads as selected rather than only being the filled one.",
			},
		},
	},
	render: () => (
		<Tabs defaultValue="transcript">
			<TabsList>
				<TabsTrigger value="transcript">Transcript</TabsTrigger>
				<TabsTrigger value="files">Files</TabsTrigger>
				<TabsTrigger value="runs">Runs</TabsTrigger>
			</TabsList>
			<TabsContent value="transcript">Every turn, in order.</TabsContent>
			<TabsContent value="files">Everything the run wrote.</TabsContent>
			<TabsContent value="runs">Every run of this routine.</TabsContent>
		</Tabs>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(
			canvas.getByRole("tab", { name: "Transcript" }),
		).toHaveAttribute("aria-selected", "true")

		await userEvent.click(canvas.getByRole("tab", { name: "Files" }))
		await waitFor(async () => {
			const panels = canvas.getAllByRole("tabpanel")

			await expect(panels).toHaveLength(1)
			await expect(panels[0]).toHaveTextContent("Everything the run wrote.")
		})
	},
})

export const Variants = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Both list variants the registry ships, derived from `tabsListVariants` so a new one fails this story at type level. Check that `default` carries its active tab on a raised surface and `line` on a rule under it — the two must never be mixed in one screen.",
			},
		},
	},
	render: () => (
		<div className="flex flex-col gap-6">
			{TABS_LIST_VARIANTS.map((variant) => (
				<Tabs defaultValue="transcript" key={variant}>
					<TabsList variant={variant}>
						<TabsTrigger value="transcript">Transcript</TabsTrigger>
						<TabsTrigger value="files">Files</TabsTrigger>
					</TabsList>
				</Tabs>
			))}
		</div>
	),
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The matrix: selected, unselected and disabled in one list, then the ring a keyboard leaves on the tab the arrows reach. Check that the disabled tab says so through `aria-disabled` rather than through dimming alone and takes no press, and that the ring is drawn on the tab itself rather than around the whole list.",
			},
		},
	},
	render: () => (
		<Tabs defaultValue="transcript">
			<TabsList>
				<TabsTrigger value="transcript">Transcript</TabsTrigger>
				<TabsTrigger value="files">Files</TabsTrigger>
				<TabsTrigger disabled value="runs">
					Runs
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
	play: async ({ canvas, userEvent }) => {
		const selected = canvas.getByRole("tab", { name: "Transcript" })
		const disabled = canvas.getByRole("tab", { name: "Runs" })

		await expect(selected).toHaveAttribute("aria-selected", "true")
		await expect(disabled).toHaveAttribute("aria-disabled", "true")

		await userEvent.tab()
		await expect(selected).toHaveFocus()
		await expect(getComputedStyle(selected).boxShadow).not.toBe("none")

		await userEvent.keyboard("{ArrowRight}")
		await expect(canvas.getByRole("tab", { name: "Files" })).toHaveFocus()
	},
})

export const LongContent = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"One label far wider than the list it sits in, in a 320px column — the shape a translated label takes. Check that the long label wraps inside the column instead of pushing its neighbours out of it, and that every other tab is still reachable by pointer and by arrow key.",
			},
		},
	},
	render: () => (
		<div className="w-80">
			<Tabs defaultValue="long">
				<TabsList className="h-fit max-w-full flex-wrap">
					<TabsTrigger
						className="h-fit min-w-0 whitespace-normal break-words text-start"
						value="long"
					>
						{LONG_LABEL}
					</TabsTrigger>
					<TabsTrigger className="h-fit" value="files">
						Files
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	),
	play: async ({ canvas, userEvent }) => {
		const list = canvas.getByRole("tablist")
		const neighbour = canvas.getByRole("tab", { name: "Files" })

		await expect(neighbour.getBoundingClientRect().right).toBeLessThanOrEqual(
			list.getBoundingClientRect().right,
		)

		await userEvent.click(neighbour)
		await expect(neighbour).toHaveAttribute("aria-selected", "true")
	},
})

export const OnDarkSurface = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The same three tabs on the dark surface. Check that the active tab is still the one that reads darkest against its raised fill and that the two resting labels keep enough contrast to be read rather than guessed — dark mode dims the resting label, it must not erase it.",
			},
		},
	},
	render: () => (
		<Tabs defaultValue="transcript">
			<TabsList>
				<TabsTrigger value="transcript">Transcript</TabsTrigger>
				<TabsTrigger value="files">Files</TabsTrigger>
				<TabsTrigger disabled value="runs">
					Runs
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
})
