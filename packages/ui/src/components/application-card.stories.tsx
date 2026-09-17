import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	listExhaustively,
	probedStyleOf,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import {
	ApplicationCard,
	type ApplicationCardFootnote,
	type ApplicationCardProps,
	type ApplicationCardStatus,
} from "@workspace/ui/components/application-card"
import { CURATED_APPLICATIONS } from "@workspace/ui/components/plugin-settings/applications.fixtures"
import { bots } from "@workspace/ui/lib/i18n-en/bots"

const LINEAR_MARK = CURATED_APPLICATIONS.find(({ id }) => id === "linear")?.mark

const APPLICATION_STATUSES = listExhaustively<ApplicationCardStatus>({
	apiKey: true,
	signIn: true,
	unavailable: true,
	connected: true,
})

const COMPANION_FOOTNOTE: ApplicationCardFootnote = {
	sentence: "Shoto has Linear in every conversation.",
	actionLabel: "Open Settings",
	onAction: fn(),
}

const meta = preview.meta({
	title: "Conversation/Tools/ApplicationCard",
	component: ApplicationCard,
	parameters: {
		docs: {
			description: {
				component:
					"One application as the conversation shows it, posted bare in the thread as the receipt of an install: a mark, a name, one description line, a trailing status and a footnote that says where the application landed and opens Settings. An application Kiroshi knows prints its display name in the sans face; one pasted or taken from the registry prints its slug in the mono face.",
			},
		},
	},
	args: {
		name: "linear",
		displayName: "Linear",
		mark: LINEAR_MARK,
		description: "Reads and files issues, projects and cycles.",
		status: "signIn",
		footnote: COMPANION_FOOTNOTE,
	} satisfies ApplicationCardProps,
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-117.5">
				<Story />
			</div>
		),
	],
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The receipt of an application Kiroshi curates, as `packages/ui/src/components/application-install-turn.tsx:90` posts it once the install lands on a companion: display name in the sans face, the sign-in dot in the attention colour of the connection dot map, and the footnote naming the companion. Pick `WithSlug` for an application the registry has no entry for.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const name = slotIn(canvasElement, "application-card-name")
		await expect(name).toHaveTextContent("Linear")
		await expect(getComputedStyle(name).fontFamily).toBe(
			probedStyleOf("font-sans", "fontFamily"),
		)
	},
})

export const WithSlug = meta.story({
	args: {
		name: "forecast",
		displayName: undefined,
		mark: undefined,
		description: "",
		status: "connected",
		footnote: {
			sentence: "You have forecast in every conversation.",
			actionLabel: "Open Settings",
			onAction: fn(),
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same receipt for an install `apps/app/src/components/application-install-row.tsx:51` found no curated entry for: no display name and no description, so the slug prints in the mono face beside the placeholder mark and the card holds its height on the footnote alone.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const name = slotIn(canvasElement, "application-card-name")
		await expect(name).toHaveTextContent("forecast")
		await expect(getComputedStyle(name).fontFamily).toBe(
			probedStyleOf("font-mono", "fontFamily"),
		)
	},
})

type StatusIndicator = {
	className: string
	property: "color" | "backgroundColor"
}

const STATUS_INDICATOR = {
	apiKey: { className: "text-muted-foreground", property: "color" },
	signIn: { className: "bg-bot-badge-attention", property: "backgroundColor" },
	unavailable: { className: "text-destructive", property: "color" },
	connected: { className: "bg-state-connected", property: "backgroundColor" },
} as const satisfies Record<ApplicationCardStatus, StatusIndicator>

const STATUS_LABEL = {
	apiKey: bots.applications.catalogue.setup.apiKey,
	signIn: bots.applications.catalogue.setup.signIn,
	unavailable: bots.applications.catalogue.setup.unavailable,
	connected: bots.applications.connection.state.connected,
} as const satisfies Record<ApplicationCardStatus, string>

export const Statuses = meta.story({
	tags: ["test-only"],
	render: (args) => (
		<div className="flex flex-col gap-1.5">
			{APPLICATION_STATUSES.map((status) => (
				<ApplicationCard key={status} {...args} status={status} />
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Every status the card can carry, stacked in a column no thread assembles: `packages/ui/src/components/application-install-turn.tsx:90` posts one card at a time, and asks for only `connected`, `apiKey` or `signIn` of the four, through the map at `apps/app/src/components/application-install-row.tsx:14`. Labels come from the catalogue setup and connection catalogues; indicators from the connection dot map and the connected token. Check an API key is a muted key, an application that can’t be added here is blocked in the destructive token, signing in carries the attention token of the connection dot map, and a connected application reads its label in the foreground token.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const statuses = slotsIn(canvasElement, "application-card-status")

		await expect(statuses).toHaveLength(APPLICATION_STATUSES.length)
		for (const [index, status] of APPLICATION_STATUSES.entries()) {
			const slot = statuses[index] as HTMLElement
			const indicator = slot.firstElementChild as Element
			const { className, property } = STATUS_INDICATOR[status]

			await expect(slot).toHaveTextContent(STATUS_LABEL[status])
			await expect(getComputedStyle(indicator)[property]).toBe(
				probedStyleOf(className, property),
			)
		}
	},
})
