import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { probedStyleOf, slotIn } from "@workspace/storybook/story-utils"
import {
	ApplicationCard,
	type ApplicationCardFootnote,
	type ApplicationCardProps,
} from "@workspace/ui/components/application-card"
import { CATALOGUE_APPLICATIONS } from "@workspace/ui/components/plugin-settings/applications.fixtures"
import { bots } from "@workspace/ui/lib/i18n-en/bots"

const LINEAR_MARK = CATALOGUE_APPLICATIONS.find(
	({ id }) => id === "linear",
)?.mark

const REMOTE_MARK =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23e8590c'/%3E%3C/svg%3E"

const CONNECTION_WORDING = [
	bots.applications.catalogue.setup.apiKey,
	bots.applications.catalogue.setup.signIn,
	bots.applications.catalogue.setup.unavailable,
	bots.applications.connection.state.connected,
]

const COMPANION_FOOTNOTE: ApplicationCardFootnote = {
	sentence: "Shoto has Linear in every conversation.",
	actionLabel: "Open Settings",
	onAction: fn(),
}

const expectNoConnectionClaim = async (canvasElement: HTMLElement) => {
	const card = slotIn(canvasElement, "application-card")
	for (const wording of CONNECTION_WORDING) {
		await expect(card).not.toHaveTextContent(wording)
	}
	await expect(
		card.querySelector('[data-slot="application-card-status"]'),
	).toBeNull()
}

const expectSansName = async (canvasElement: HTMLElement, name: string) => {
	const slot = slotIn(canvasElement, "application-card-name")
	await expect(slot).toHaveTextContent(name)
	await expect(getComputedStyle(slot).fontFamily).toBe(
		probedStyleOf("font-sans", "fontFamily"),
	)
}

const meta = preview.meta({
	title: "Conversation/Tools/ApplicationCard",
	component: ApplicationCard,
	parameters: {
		docs: {
			description: {
				component:
					"One application as the conversation shows it, posted bare in the thread as the receipt of an install: a mark, its readable name in the sans face, one description line when the install holds one, and a footnote that says where the application landed and opens Settings. The receipt claims nothing about the connection: it is written once, when the install lands, and no connection is read for it.",
			},
		},
	},
	args: {
		name: "Linear",
		mark: LINEAR_MARK,
		description: "Reads and files issues, projects and cycles.",
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
					"The receipt of an application whose install row holds an inline logo, as `packages/ui/src/components/application-install-turn.tsx:90` posts it once the install lands on a companion. Pick `WithRemoteMark` for an application from the directory, which holds an icon url instead.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectSansName(canvasElement, "Linear")
		await expect(
			slotIn(canvasElement, "application-card-description"),
		).toHaveTextContent("Reads and files issues, projects and cycles.")
		await expectNoConnectionClaim(canvasElement)
	},
})

export const WithRemoteMark = meta.story({
	args: {
		name: "Forecast",
		mark: REMOTE_MARK,
		description: "Reads the weather for the places you plan around.",
		footnote: {
			sentence: "You have Forecast in every conversation.",
			actionLabel: "Open Settings",
			onAction: fn(),
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"The receipt of an application the curated catalogue does not hold, taken from the directory: the install row carries its readable name, its description and a remote icon url, so the mark is an image of that url and the name still prints in the sans face.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const image = slotIn(canvasElement, "application-mark").querySelector("img")
		await expect(image).toHaveAttribute("src", REMOTE_MARK)
		await expectSansName(canvasElement, "Forecast")
		await expectNoConnectionClaim(canvasElement)
	},
})

export const WithoutMarkOrDescription = meta.story({
	args: {
		name: "Forecast",
		mark: undefined,
		description: undefined,
		footnote: {
			sentence: "You have Forecast in every conversation.",
			actionLabel: "Open Settings",
			onAction: fn(),
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"The receipt of an install written before the row held an icon url or a description, for an application the curated catalogue does not hold: the placeholder mark, the readable name, and no description line.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const mark = slotIn(canvasElement, "application-mark")
		await expect(mark.querySelector("img")).toBeNull()
		await expect(mark.querySelector("svg")).not.toBeNull()
		await expectSansName(canvasElement, "Forecast")
		await expect(
			canvasElement.querySelector('[data-slot="application-card-description"]'),
		).toBeNull()
		await expectNoConnectionClaim(canvasElement)
	},
})
