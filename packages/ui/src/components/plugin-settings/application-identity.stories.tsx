import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	ApplicationMetaLine,
	ApplicationVerifiedPill,
} from "@workspace/ui/components/plugin-settings/application-identity"

const meta = preview.meta({
	title: "Settings/Plugins/ApplicationIdentity",
	component: ApplicationMetaLine,
	parameters: {
		docs: {
			description: {
				component:
					"What a registry result says about itself under its name: the source that published it, how many people run it, and where it runs. Parts come in that order, each one dropped with the separator before it when its data is absent. A hosted application names its host instead of its package identity, and both read in the mono family.",
			},
		},
	},
	args: { source: "Smithery", useCount: 12110 },
})

export const SourceAndUses = meta.story({
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Smithery")).toBeVisible()
		await expect(canvas.getByText("12,110 uses")).toBeVisible()
	},
})

export const OneUse = meta.story({
	args: { useCount: 1 },
	parameters: {
		docs: {
			description: {
				story: "A single run reads as one use rather than one uses.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("1 use")).toBeVisible()
	},
})

export const HostedResult = meta.story({
	args: {
		host: "slack.run.tools",
		packageIdentity: "https://slack.run.tools/mcp",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A hosted result. Check that the host closes the line in the mono family and that the package identity is left out.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("slack.run.tools")).toHaveClass("font-mono")
		await expect(canvas.getByText(/Runs on/)).toBeVisible()
		await expect(
			canvas.queryByText("https://slack.run.tools/mcp"),
		).not.toBeInTheDocument()
	},
})

export const PackageResult = meta.story({
	args: {
		useCount: undefined,
		source: "MCP registry",
		packageIdentity: "npx -y @kwn/granola-transcripts",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A result nobody hosts. Check that the package identity closes the line in the mono family and that no separator sits where the use count would be.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("npx -y @kwn/granola-transcripts"),
		).toHaveClass("font-mono")
		await expect(canvas.queryByText(/uses/)).not.toBeInTheDocument()
	},
})

export const NothingToSay = meta.story({
	args: { source: undefined, useCount: undefined },
	parameters: {
		docs: {
			description: {
				story:
					"A result carrying none of the four. Check that no line is drawn at all, separator included.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-slot="application-meta"]'),
		).toBeNull()
	},
})

export const Verified = meta.story({
	render: () => <ApplicationVerifiedPill />,
	parameters: {
		docs: {
			description: {
				story:
					"The pill a source attests a result with. It sits after the name and takes the muted surface.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Verified")).toBeVisible()
	},
})
