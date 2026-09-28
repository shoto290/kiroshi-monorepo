import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@workspace/ui/components/ui/accordion"

const SECTIONS = [
	{ title: "Shipping", body: "Orders leave the warehouse within two days." },
	{
		title: "Returns",
		body: "Send an item back within thirty days of delivery.",
	},
	{ title: "Warranty", body: "Every product is covered for one full year." },
] as const

const renderSections = (defaultValue: string[]) => (
	<Accordion defaultValue={defaultValue}>
		{SECTIONS.map(({ title, body }) => (
			<AccordionItem key={title} value={title}>
				<AccordionTrigger>{title}</AccordionTrigger>
				<AccordionContent>{body}</AccordionContent>
			</AccordionItem>
		))}
	</Accordion>
)

const meta = preview.meta({
	title: "Primitives/Accordion",
	component: Accordion,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The registry accordion on Base UI: each trigger is a button inside a heading, reports its panel through aria-expanded, and hands focus to its neighbours on ArrowDown and ArrowUp. Compose it rather than editing it; FaqList is the house composition.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => renderSections([]),
	parameters: {
		docs: {
			description: {
				story:
					"Every section closed, the state a reader lands on. Check that each trigger shows its closed indicator and that no panel text is in the page. Pick `OneOpen` for the expanded panel.",
			},
		},
	},
	play: async ({ canvas }) => {
		for (const trigger of canvas.getAllByRole("button")) {
			await expect(trigger).toHaveAttribute("aria-expanded", "false")
		}
	},
})

export const OneOpen = meta.story({
	render: () => renderSections(["Returns"]),
	parameters: {
		docs: {
			description: {
				story:
					"The middle section expanded, its neighbours closed. Check the open indicator on its trigger and that its panel sits between the two closed rows. Pick `Default` for the closed stack.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("button", { name: "Returns" }),
		).toHaveAttribute("aria-expanded", "true")
		await expect(canvas.getByText(SECTIONS[1].body)).toBeVisible()
	},
})
