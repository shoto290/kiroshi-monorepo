import type { ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { elementNode, textNode } from "@workspace/storybook/story-utils"
import { CONVERSATION_BOTS } from "@workspace/ui/components/bots.fixtures"
import {
	BOT_MENTION_ATTRIBUTE,
	BOT_MENTION_COUNT_ATTRIBUTE,
} from "@workspace/ui/components/markdown/bot-mentions"
import { MarkdownSpan } from "@workspace/ui/components/markdown/mention"
import { RosterProvider } from "@workspace/ui/components/roster"

const [ATLAS] = CONVERSATION_BOTS

const PLAIN_TEXT = "the failing migration"

const Message = ({ children }: { children: ReactNode }) => (
	<RosterProvider bots={CONVERSATION_BOTS}>
		<p className="max-w-md text-sm leading-6">{children}</p>
	</RosterProvider>
)

const meta = preview.meta({
	title: "Conversation/Markdown/MarkdownSpan",
	component: MarkdownSpan,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The fork every span of a rendered message goes through. The mention plugin marks the spans it created with a bot id, and this component turns those — and only those — into the mention chip; every other span is written back as the span the parser produced, with its attributes untouched. Keeping the fork here is what lets a message hold a mention without the sanitizer having to trust any markup the model wrote.",
			},
		},
	},
	decorators: [(Story) => <Message>{Story()}</Message>],
})

export const BotMention = meta.story({
	args: {
		[BOT_MENTION_ATTRIBUTE]: ATLAS.id,
		[BOT_MENTION_COUNT_ATTRIBUTE]: 1,
		children: ATLAS.name,
		node: elementNode("span", [textNode(ATLAS.name)], {
			[BOT_MENTION_ATTRIBUTE]: ATLAS.id,
		}),
	},
	parameters: {
		docs: {
			description: {
				story:
					"A span the mention plugin marked with a bot id: it becomes the chip, avatar and name, rather than the text the author typed. Check that the name shown is the one the roster holds — the message carries the id, never a name that could go stale — and that the chip sits on the text line without pushing it apart. Pick `PlainText` for every other span in the same message. `packages/ui/src/components/markdown/components.tsx:17` hands every parsed span to this component while rendering a message.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const chip = canvasElement.querySelector('[data-slot="bot-mention"]')

		await expect(chip).not.toBeNull()
		await expect(canvas.getByText(ATLAS.name)).toBeVisible()
		await expect(chip).not.toHaveAttribute(BOT_MENTION_ATTRIBUTE)
	},
})

export const PlainText = meta.story({
	args: {
		children: PLAIN_TEXT,
		className: "text-muted-foreground",
		node: elementNode("span", [textNode(PLAIN_TEXT)]),
	},
	parameters: {
		docs: {
			description: {
				story:
					"A span with no bot id, which is every span a model writes on its own. Check that it comes out as a plain span carrying its own class and its own text — no chip, no avatar, nothing added — so styling written in a message survives the fork untouched. `packages/ui/src/components/markdown/components.tsx:17` hands every parsed span to this component while rendering a message.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const text = canvas.getByText(PLAIN_TEXT)

		await expect(canvasElement.querySelector('[data-slot="bot-mention"]')).toBe(
			null,
		)
		await expect(text.tagName).toBe("SPAN")
		await expect(text).toHaveClass("text-muted-foreground")
	},
})
