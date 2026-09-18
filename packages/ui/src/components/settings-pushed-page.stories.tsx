import { Tabs } from "@base-ui/react/tabs"
import { useState } from "react"
import { expect, fn, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Icons } from "@workspace/ui/components/icons"
import {
	SettingsPushedPage,
	type SettingsPushedPageProps,
} from "@workspace/ui/components/settings-pushed-page"
import {
	SETTINGS_PANEL_CLASS,
	SettingsRailItem,
} from "@workspace/ui/components/settings-rail"
import { cn } from "@workspace/ui/lib/utils"

const SECTIONS = [
	{ icon: Icons.Docs, label: "Instructions", value: "instructions" },
	{ icon: Icons.Terminal, label: "Execution", value: "execution" },
	{ icon: Icons.Settings, label: "Advanced", value: "advanced" },
]

const railOf = (iconsOnly: boolean) =>
	SECTIONS.map((section) => (
		<SettingsRailItem
			icon={section.icon}
			iconsOnly={iconsOnly}
			key={section.value}
			label={section.label}
			value={section.value}
		/>
	))

const panels = SECTIONS.map((section) => (
	<Tabs.Panel
		className={SETTINGS_PANEL_CLASS}
		key={section.value}
		value={section.value}
	>
		<span className="text-muted-foreground text-sm">{section.value}</span>
	</Tabs.Panel>
))

const WIDE = "w-[48rem]"
const NARROW = "w-[32rem]"

type FramedPageProps = SettingsPushedPageProps & { frame: string }

const FramedPage = ({ frame, ...page }: FramedPageProps) => (
	<div
		className={cn(
			"flex h-72 overflow-hidden rounded-2xl border border-border",
			frame,
		)}
	>
		<SettingsPushedPage {...page} />
	</div>
)

const ControlledPage = (props: FramedPageProps) => {
	const [value, setValue] = useState("execution")

	return (
		<FramedPage
			{...props}
			onValueChange={(next) => setValue(String(next))}
			value={value}
		/>
	)
}

const meta = preview.meta({
	title: "Navigation/SettingsPushedPage",
	component: SettingsPushedPage,
	render: (args) => <FramedPage {...args} frame={NARROW} />,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"A page pushed over the tabs of a settings dialog: a skill, an application, a change of the history, the catalogue. It draws the rail with the way back at its head and a rule under it, then the entries the page hands it. A page that measures its own width drops the rail names below the rail label width and gives that answer to its entries; a page that does not keeps every name at every width.",
			},
		},
	},
	args: {
		backLabel: "All skills",
		onBack: fn(),
		defaultValue: "instructions",
		rail: railOf,
		children: panels,
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A page that does not measure itself, in a narrow frame. Check that the back control and every entry keep their names, and that the back control answers Enter. Pick `MeasuredNarrow` for a page that folds its rail.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText("Instructions")).toBeVisible()
		await expect(canvas.getByText("All skills")).toBeVisible()

		canvas.getByRole("button", { name: "All skills" }).focus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onBack).toHaveBeenCalledOnce()
	},
})

export const MeasuredNarrow = meta.story({
	args: { isMeasured: true },
	parameters: {
		docs: {
			description: {
				story:
					"A page that measures itself, narrower than the rail label width. Check that the back control and the entries fold to their icons at once while staying named to a screen reader. Pick `MeasuredWide` for the same page with room.",
			},
		},
	},
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(canvas.getByText("Instructions")).toHaveClass("sr-only"),
		)
		await expect(canvas.getByText("All skills")).toHaveClass("sr-only")
	},
})

export const MeasuredWide = meta.story({
	args: { isMeasured: true },
	render: (args) => <FramedPage {...args} frame={WIDE} />,
	parameters: {
		docs: {
			description: {
				story:
					"A page that measures itself, wider than the rail label width. Check that every name stays on the screen.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Instructions")).not.toHaveClass("sr-only")
		await expect(canvas.getByText("All skills")).not.toHaveClass("sr-only")
	},
})

export const Controlled = meta.story({
	args: { defaultValue: undefined },
	render: (args) => <ControlledPage {...args} frame={NARROW} />,
	parameters: {
		docs: {
			description: {
				story:
					"A page whose owner holds the open entry, as the history change and the catalogue do. Check that the entry the owner names is the open one and that picking another moves it.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const execution = canvas.getByRole("tab", { name: "Execution" })
		const advanced = canvas.getByRole("tab", { name: "Advanced" })

		await expect(execution).toHaveAttribute("aria-selected", "true")
		await userEvent.click(advanced)
		await expect(advanced).toHaveAttribute("aria-selected", "true")
	},
})
