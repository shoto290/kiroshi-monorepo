import { useState } from "react"
import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	CATALOGUE_CATEGORIES,
	CURATED_APPLICATIONS,
	PUBLISHED_APPLICATION_COUNT,
	REGISTRY_APPLICATIONS,
} from "@workspace/ui/components/plugin-settings/applications.fixtures"
import {
	ApplicationsCatalogue,
	type ApplicationsCatalogueProps,
	type CatalogueApplication,
} from "@workspace/ui/components/plugin-settings/applications-catalogue"

const CARD_BOTTOM_INSET = 13

const ROW_GAP = 9

const ROW_SKELETON_HEIGHT = 59

const slotsOf = (canvasElement: HTMLElement, slot: string) => [
	...canvasElement.querySelectorAll(`[data-slot="${slot}"]`),
]

const matching = (applications: CatalogueApplication[], query: string) =>
	applications.filter((application) =>
		application.name.toLowerCase().includes(query.trim().toLowerCase()),
	)

const CatalogueHost = (props: ApplicationsCatalogueProps) => {
	const [query, setQuery] = useState(props.query)
	const [category, setCategory] = useState(props.category)
	const isTyped = query.trim() !== ""

	return (
		<ApplicationsCatalogue
			{...props}
			category={category}
			curated={matching(props.curated, query)}
			onCategoryChange={(next) => {
				setCategory(next)
				props.onCategoryChange(next)
			}}
			onQueryChange={(next) => {
				setQuery(next)
				props.onQueryChange(next)
			}}
			query={query}
			registry={isTyped ? matching(props.registry, query) : []}
		/>
	)
}

const meta = preview.meta({
	title: "Settings/Plugins/ApplicationsCatalogue",
	component: ApplicationsCatalogue,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The page Add application pushes over the whole dialog body, rail included. The rail lists categories handed as data, keeps its labels at every width, and ends on Paste a configuration. The body reports what is typed and draws only the applications it is handed: the curated ones Kiroshi knows, then what the MCP registry returned.",
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
		categories: CATALOGUE_CATEGORIES,
		category: "everything",
		onCategoryChange: fn(),
		query: "",
		onQueryChange: fn(),
		curated: CURATED_APPLICATIONS,
		registry: REGISTRY_APPLICATIONS,
		publishedCount: PUBLISHED_APPLICATION_COUNT,
		onRegistryRetry: fn(),
		onPick: fn(),
		onBack: fn(),
		onPaste: fn(),
	},
	render: (args) => <CatalogueHost {...args} />,
})

export const AtRest = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The catalogue as it opens. Check the back item, the open category on muted with its count, the curated cards at their drawn width, every install line of a row resting on one line at the bottom of its card, no dashed line anywhere, and the registry rows drawn full width, sans name and sans description, the package identity alone in monospace.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const everything = canvas.getByRole("tab", { name: /Everything/ })
		await expect(everything).toHaveAttribute("aria-selected", "true")
		await expect(everything).toHaveTextContent("6")
		await expect(canvas.getByRole("tab", { name: "Design" })).toHaveTextContent(
			/^Design$/,
		)
		const rest = canvas.getByText(
			/Type a name above to search 1,?284 published applications\./,
		)
		await expect(rest).toBeVisible()
		await expect(rest).toHaveAttribute("aria-live", "off")
		await expect(
			canvas.getAllByRole("listitem")[0].getBoundingClientRect().width,
		).toBe(186)
		await expect(
			canvas.getByText("We check what they do before listing them."),
		).toBeVisible()
		await expect(
			canvas.getByText(
				"Published by anyone. Read what it does before you add it.",
			),
		).toBeVisible()
		await expect(
			canvas.getByText("Looks in the MCP registry too"),
		).toBeVisible()
		await expect(canvasElement.querySelector(".border-dashed")).toBeNull()

		const cards = canvas.getAllByRole("listitem")
		const firstRowTop = cards[0].getBoundingClientRect().top
		const firstRow = cards.filter(
			(card) => card.getBoundingClientRect().top === firstRowTop,
		)
		await expect(firstRow.length).toBeGreaterThan(1)
		const setupTops = firstRow.map((card) => {
			const setup = card.querySelector('[data-slot="catalogue-card-setup"]')
			const box = card.getBoundingClientRect()
			const line = setup?.getBoundingClientRect()
			return {
				top: Math.round(line?.top ?? 0),
				gap: Math.round(box.bottom - (line?.bottom ?? 0)),
			}
		})
		await expect(new Set(setupTops.map((line) => line.top)).size).toBe(1)
		await expect(new Set(setupTops.map((line) => line.gap))).toEqual(
			new Set([CARD_BOTTOM_INSET]),
		)

		await userEvent.click(canvas.getByRole("tab", { name: "Design" }))
		await expect(args.onCategoryChange).toHaveBeenCalledWith("design")

		await userEvent.click(canvas.getByRole("button", { name: /Linear/ }))
		await expect(args.onPick).toHaveBeenCalledWith(CURATED_APPLICATIONS[0])

		await userEvent.click(
			canvas.getByRole("button", { name: "Paste a configuration" }),
		)
		await userEvent.click(
			canvas.getByRole("button", { name: "All applications" }),
		)
		await expect(args.onPaste).toHaveBeenCalledTimes(1)
		await expect(args.onBack).toHaveBeenCalledTimes(1)

		await userEvent.type(
			canvas.getByRole("textbox", { name: "Search applications" }),
			"lin",
		)

		const registryName = canvas.getByText("linkboard")
		await expect(registryName).not.toHaveClass("font-mono")
		await expect(registryName).toHaveClass("font-medium")
		await expect(
			canvas.getByText("A smaller Linear server that only reads issues."),
		).not.toHaveClass("font-mono")
		await expect(canvas.getByText("npx -y @kwn/linkboard-mcp")).toHaveClass(
			"font-mono",
		)
		const row = registryName.closest("li")?.getBoundingClientRect()
		await expect(row?.width).toBeGreaterThan(186)
	},
})

export const WithoutPublishedCount = meta.story({
	args: { publishedCount: undefined },
	parameters: {
		docs: {
			description: {
				story:
					"A registry whose size is not known. Check that the line at rest states no count.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(
				"Type a name above to search the published applications.",
			),
		).toBeVisible()
	},
})

export const WithResults = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A search that matches in both sections. Check that every keystroke is reported and that only the handed applications are drawn: Linear among the curated, linear-lite from the registry.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Search applications" }),
			"lin",
		)

		await expect(args.onQueryChange).toHaveBeenLastCalledWith("lin")
		await expect(canvas.getByText("Linear")).toBeVisible()
		await expect(canvas.getByText("linear-lite")).toBeVisible()
		await expect(canvas.queryByText("Notion")).not.toBeInTheDocument()
	},
})

export const NothingMatched = meta.story({
	args: { query: "zebra" },
	parameters: {
		docs: {
			description: {
				story:
					"A search that matches nothing anywhere. Check that the line repeats the words typed and points at pasting a configuration.",
			},
		},
	},
	play: async ({ canvas }) => {
		const nothing = canvas.getByText(
			"Nothing matched zebra. Try another name, or paste a configuration.",
		)
		await expect(nothing).toBeVisible()
		await expect(nothing).toHaveAttribute("aria-live", "polite")
	},
})

export const RegistrySearching = meta.story({
	args: { query: "zebra", isRegistrySearching: true },
	parameters: {
		docs: {
			description: {
				story:
					"A registry search still in flight. Check that the registry section draws three row skeletons rather than claiming nothing matched.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotsOf(canvasElement, "catalogue-row-skeleton")).toHaveLength(
			3,
		)
		await expect(canvas.queryByText(/Nothing matched/)).not.toBeInTheDocument()
		await expect(canvas.getByRole("tabpanel")).toHaveAttribute(
			"aria-busy",
			"true",
		)
	},
})

export const RegistryEmptyBesideCurated = meta.story({
	args: { query: "lin", registry: [] },
	parameters: {
		docs: {
			description: {
				story:
					"A search the curated list answers and the registry does not. Check that the registry section stays, saying the registry returned nothing for the words typed.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Linear")).toBeVisible()
		await expect(
			canvas.getByText("Nothing in the MCP registry matched lin."),
		).toBeVisible()
	},
})

export const RegistryUnreadable = meta.story({
	args: { query: "lin", hasRegistryFailed: true },
	parameters: {
		docs: {
			description: {
				story:
					"The registry could not be reached. Check that the curated match still shows, that the registry section says so, and that one Retry is offered.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(
			canvas.getByText("Couldn’t reach the MCP registry."),
		).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "Retry" }))

		await expect(args.onRegistryRetry).toHaveBeenCalledTimes(1)
	},
})

export const NarrowDialog = meta.story({
	decorators: [
		(Story) => (
			<div className="flex h-full w-[40rem]">
				<Story />
			</div>
		),
	],
	parameters: {
		docs: {
			description: {
				story:
					"The catalogue in a dialog squeezed narrow. Check that the category rail keeps its labels, unlike the settings rail that folds to icons, and that the cards keep their width and reflow to two per line.",
			},
		},
	},
	play: async ({ canvas }) => {
		const [first, second, third] = canvas
			.getAllByRole("listitem")
			.map((card) => card.getBoundingClientRect())
		await expect(first.width).toBe(186)
		await expect(second.top).toBe(first.top)
		await expect(third.top).toBeGreaterThan(first.top)
		await expect(canvas.getByText("Work tracking")).toBeVisible()
		await expect(canvas.getByText("All applications")).not.toHaveClass(
			"sr-only",
		)
	},
})

export const CatalogueLoading = meta.story({
	args: {
		categories: [
			{ id: "everything", label: "Everything", count: null },
			...CATALOGUE_CATEGORIES.slice(1),
		],
		isCatalogueLoading: true,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The catalogue opening, nothing typed yet. Check that both sections draw skeletons: six card skeletons, three row skeletons of three bars each, nine apart, the em dash where the Everything count goes, the body marked busy and the polite line saying the catalogue is loading, announced from outside the busy body.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByRole("textbox")).toHaveValue("")
		await expect(
			slotsOf(canvasElement, "catalogue-card-skeleton"),
		).toHaveLength(6)
		const rows = slotsOf(canvasElement, "catalogue-row-skeleton")
		await expect(rows).toHaveLength(3)
		await expect(
			canvas.queryByText(/Type a name above/),
		).not.toBeInTheDocument()

		const [first, second] = rows.map((row) => row.getBoundingClientRect())
		await expect(Math.round(first.height)).toBe(ROW_SKELETON_HEIGHT)
		await expect(Math.round(second.top - first.bottom)).toBe(ROW_GAP)

		const everything = canvas.getByRole("tab", { name: "Everything" })
		await expect(everything).toHaveTextContent("\u2014")

		const body = canvas.getByRole("tabpanel")
		await expect(body).toHaveAttribute("aria-busy", "true")
		const announcement = canvas.getByRole("status")
		await expect(announcement).toHaveTextContent(
			"Loading the applications catalogue",
		)
		await expect(body.contains(announcement)).toBe(false)

		const [bar] = slotsOf(canvasElement, "skeleton")
		await expect(bar).toHaveClass("motion-reduce:animate-none")
	},
})
