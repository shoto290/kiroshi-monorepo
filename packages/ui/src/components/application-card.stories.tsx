import type { ReactNode } from "react"
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
import { Icons } from "@workspace/ui/components/icons"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
	MessageBubble,
	MessageBubbleContent,
} from "@workspace/ui/components/message-bubble"
import { CURATED_APPLICATIONS } from "@workspace/ui/components/plugin-settings/applications.fixtures"
import { ToolQuestion } from "@workspace/ui/components/tool-question"
import { bots } from "@workspace/ui/lib/i18n-en/bots"

const SENTRY_MARK = CURATED_APPLICATIONS.find(({ id }) => id === "sentry")?.mark
const LINEAR_MARK = CURATED_APPLICATIONS.find(({ id }) => id === "linear")?.mark

const APPLICATION_STATUSES = listExhaustively<ApplicationCardStatus>({
	none: true,
	apiKey: true,
	signIn: true,
	unavailable: true,
	waiting: true,
	connected: true,
})

const expectInside = async (inner: Element, outer: Element) => {
	const innerBox = inner.getBoundingClientRect()
	const outerBox = outer.getBoundingClientRect()
	await expect(innerBox.left).toBeGreaterThanOrEqual(outerBox.left)
	await expect(innerBox.right).toBeLessThanOrEqual(outerBox.right)
}

const COMPANION_FOOTNOTE: ApplicationCardFootnote = {
	sentence: "Shoto has Linear in every conversation.",
	actionLabel: "Open Settings",
	onAction: fn(),
}

type InstallRowProps = {
	children: ReactNode
}

const InstallRow = ({ children }: InstallRowProps) => (
	<Message from="assistant">
		<MessageContent>{children}</MessageContent>
	</Message>
)

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
			<div className="mx-auto max-w-177.5">
				<Story />
			</div>
		),
	],
	render: (args) => (
		<InstallRow>
			<ApplicationCard {...args} />
		</InstallRow>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The receipt of an application Kiroshi curates, as `apps/app/src/components/application-install-row.tsx:108` posts it once the install lands on a companion: display name in the sans face, the sign-in dot in the attention colour of the connection dot map, and the footnote naming the companion. Pick `WithSlug` for an application the registry has no entry for.",
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
					"The same receipt for an install `apps/app/src/components/application-install-row.tsx:108` found no curated entry for: no display name and no description, so the slug prints in the mono face beside the placeholder mark and the card holds its height on the footnote alone.",
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
	none: { className: "text-state-connected", property: "color" },
	apiKey: { className: "text-muted-foreground", property: "color" },
	signIn: { className: "bg-bot-badge-attention", property: "backgroundColor" },
	unavailable: { className: "text-destructive", property: "color" },
	waiting: { className: "bg-bot-badge-attention", property: "backgroundColor" },
	connected: { className: "bg-state-connected", property: "backgroundColor" },
} as const satisfies Record<ApplicationCardStatus, StatusIndicator>

const STATUS_LABEL = {
	none: bots.applications.catalogue.setup.none,
	apiKey: bots.applications.catalogue.setup.apiKey,
	signIn: bots.applications.catalogue.setup.signIn,
	unavailable: bots.applications.catalogue.setup.unavailable,
	waiting: bots.applications.connection.waiting,
	connected: bots.applications.connection.state.connected,
} as const satisfies Record<ApplicationCardStatus, string>

export const Statuses = meta.story({
	tags: ["test-only"],
	render: (args) => (
		<InstallRow>
			{APPLICATION_STATUSES.map((status) => (
				<ApplicationCard key={status} {...args} status={status} />
			))}
		</InstallRow>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Every status the card can carry, stacked in a column no thread assembles: `apps/app/src/components/application-install-row.tsx:108` posts one card at a time, and asks for only `connected`, `apiKey` or `signIn` of the six, through the map at `apps/app/src/components/application-install-row.tsx:20`. Labels come from the catalogue setup and connection catalogues; indicators from the connection dot map and the connected token. Check nothing to set up is a check stroked in the connected token, an API key is a muted key, an application that can’t be added here is blocked in the destructive token, signing in and waiting on the browser share the attention token, and a connected application reads its label in the foreground token.",
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

const LeftOutKeyBubble = () => (
	<MessageBubble>
		<MessageBubbleContent>
			<ToolQuestion
				questions={[
					{
						isNotice: true,
						header: "Sentry",
						failure: {
							title: "Sentry refused the key",
							detail: "Its key goes in SENTRY_AUTH_TOKEN.",
						},
						action: {
							label: "Open Settings",
							icon: Icons.Settings,
							onSelect: fn(),
						},
					},
				]}
			/>
		</MessageBubbleContent>
	</MessageBubble>
)

const RECEIPT_FOOTNOTE: ApplicationCardFootnote = {
	sentence: "Shoto has Sentry in every conversation.",
	actionLabel: "Open Settings",
	onAction: fn(),
}

const RECEIPT: ApplicationCardProps = {
	name: "sentry",
	displayName: undefined,
	mark: SENTRY_MARK,
	description: "Pulls the errors and traces behind a release.",
	status: "apiKey",
	footnote: RECEIPT_FOOTNOTE,
}

export const Receipt = meta.story({
	args: RECEIPT,
	render: (args) => (
		<InstallRow>
			<LeftOutKeyBubble />
			<ApplicationCard {...args} />
		</InstallRow>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard E11, the row `apps/app/src/components/application-install-row.tsx:101` assembles when the key an install needs was left out: the notice bubble naming the failure and the way to Settings with no key field, then the receipt posted bare under it. Check that the receipt is bordered, names the slug in the mono face, and separates its footnote by one rule with a muted sentence and a control that opens Settings. Pick `ReceiptNarrow` for a 320px column.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const receipt = slotIn(canvasElement, "application-receipt")
		const name = slotIn(receipt, "application-card-name")
		const footnote = receipt.lastElementChild as HTMLElement
		const settings = canvas.getAllByRole("button", { name: "Open Settings" })
		const openSettings = settings.at(-1) as HTMLElement

		await expect(receipt.closest('[data-slot="message-bubble"]')).toBeNull()
		await expect(receipt.getBoundingClientRect().width).toBeLessThanOrEqual(470)
		await expect(getComputedStyle(receipt).borderTopWidth).toBe("1px")
		await expect(getComputedStyle(footnote).borderTopWidth).toBe("1px")
		await expect(name).toHaveTextContent("sentry")
		await expect(getComputedStyle(name).fontFamily).toBe(
			probedStyleOf("font-mono", "fontFamily"),
		)
		await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument()
		await expect(canvas.getByRole("form")).toHaveAccessibleName(
			"Sentry refused the key",
		)

		openSettings.focus()
		await expect(openSettings.matches(":focus-visible")).toBe(true)
		await expect(getComputedStyle(openSettings).boxShadow).not.toBe("none")
		await userEvent.keyboard("{Enter}")
		await expect(args.footnote?.onAction).toHaveBeenCalledTimes(1)
	},
})

const NARROW_FOOTNOTE: ApplicationCardFootnote = {
	sentence:
		"Shoto has Sentry in every conversation, and so does every companion you add later.",
	actionLabel: "Open Settings",
	onAction: fn(),
}

export const ReceiptNarrow = meta.story({
	args: { ...RECEIPT, footnote: NARROW_FOOTNOTE },
	decorators: [
		(Story) => (
			<div className="w-[320px]" data-testid="column">
				<Story />
			</div>
		),
	],
	parameters: {
		docs: {
			description: {
				story:
					"The receipt of `apps/app/src/components/application-install-row.tsx:108` in a 320px column, which is also what 200 percent zoom leaves. The footnote sentence wraps and its control keeps its full label at the inline end, both inside the column. Pick `Receipt` for the thread it is posted in.",
			},
		},
	},
	play: async ({ canvas }) => {
		const column = canvas.getByTestId("column")
		const sentence = canvas.getByText(NARROW_FOOTNOTE.sentence)
		const control = canvas.getByRole("button", {
			name: NARROW_FOOTNOTE.actionLabel,
		})

		await expectInside(sentence, column)
		await expectInside(control, column)
		await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth)
		await expect(column.scrollWidth).toBeLessThanOrEqual(column.clientWidth)
	},
})
