import { Button } from "@workspace/ui/components/button"
import {
	MessageBubble,
	MessageBubbleContent,
	MessageBubbleGroup,
} from "@workspace/ui/components/message-bubble"

import { WEBSITE_COPY } from "./copy"

export const WebsitePage = () => (
	<MessageBubbleGroup spacing="default">
		<MessageBubble>
			<MessageBubbleContent>{WEBSITE_COPY.bubble}</MessageBubbleContent>
		</MessageBubble>
		<Button size="lg">{WEBSITE_COPY.action}</Button>
	</MessageBubbleGroup>
)
