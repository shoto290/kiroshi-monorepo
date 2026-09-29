import type { KeyboardEvent } from "react"

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@workspace/ui/components/ui/accordion"

interface FaqItem {
	question: string
	answer: string
}

interface FaqListProps {
	items: readonly FaqItem[]
	defaultOpen?: string[]
}

const FOCUS_STEP: Partial<Record<string, number>> = {
	ArrowDown: 1,
	ArrowUp: -1,
}

const moveTriggerFocus = (event: KeyboardEvent<HTMLDivElement>) => {
	const step = FOCUS_STEP[event.key]
	if (!step) return
	const triggers = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>(
			"[data-slot=accordion-trigger]",
		),
	)
	const current = triggers.indexOf(event.target as HTMLElement)
	if (current === -1) return
	event.preventDefault()
	triggers.at((current + step) % triggers.length)?.focus()
}

const FaqList = ({ items, defaultOpen }: FaqListProps) => (
	<Accordion
		className="rounded-none border-0 border-t **:data-[slot=accordion-content]:px-0 motion-reduce:**:data-[slot=accordion-content]:animate-none"
		defaultValue={defaultOpen}
		multiple
		onKeyDown={moveTriggerFocus}
	>
		{items.map(({ question, answer }) => (
			<AccordionItem
				className="border-b pb-5 data-open:bg-transparent"
				key={question}
				value={question}
			>
				<AccordionTrigger className="min-w-0 px-0 pt-5 pb-0 text-start font-sans text-base font-medium text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 **:data-[slot=accordion-trigger-icon]:mt-1">
					<span className="min-w-0 wrap-anywhere">{question}</span>
				</AccordionTrigger>
				<AccordionContent className="pt-1.5 pb-0 font-sans text-reading text-muted-foreground wrap-anywhere">
					{answer}
				</AccordionContent>
			</AccordionItem>
		))}
	</Accordion>
)

export { type FaqItem, FaqList }
