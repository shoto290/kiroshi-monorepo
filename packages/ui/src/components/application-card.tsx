"use client"

import { ApplicationMark } from "@workspace/ui/components/plugin-settings/application-mark"
import { cn } from "@workspace/ui/lib/utils"

type ApplicationCardFootnote = {
	sentence: string
	actionLabel: string
	onAction: () => void
}

type ApplicationCardProps = {
	name: string
	mark?: string
	description?: string
	footnote?: ApplicationCardFootnote
}

type ApplicationCardHeaderProps = Omit<ApplicationCardProps, "footnote"> & {
	className?: string
}

const ApplicationCardHeader = ({
	name,
	mark,
	description,
	className,
}: ApplicationCardHeaderProps) => (
	<div
		className={cn("flex min-w-0 items-center gap-2.5 px-3 py-2.5", className)}
		data-slot="application-card"
	>
		<ApplicationMark mark={mark} size="card" />
		<div className="flex min-w-0 flex-1 flex-col">
			<span
				className="truncate font-medium text-foreground text-sm leading-5"
				data-slot="application-card-name"
			>
				{name}
			</span>
			{description ? (
				<span
					className="wrap-break-word text-muted-foreground text-xs leading-4"
					data-slot="application-card-description"
				>
					{description}
				</span>
			) : null}
		</div>
	</div>
)

const ApplicationCard = ({ footnote, ...application }: ApplicationCardProps) =>
	footnote ? (
		<div
			className="w-full overflow-hidden rounded-control border border-border bg-background"
			data-slot="application-receipt"
		>
			<ApplicationCardHeader {...application} />
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-border border-t px-3 py-2">
				<p className="min-w-0 wrap-break-word text-muted-foreground text-xs leading-4">
					{footnote.sentence}
				</p>
				<button
					className="-my-1 ms-auto shrink-0 cursor-pointer rounded-sm py-1 font-medium text-foreground text-xs leading-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
					onClick={footnote.onAction}
					type="button"
				>
					{footnote.actionLabel}
				</button>
			</div>
		</div>
	) : (
		<ApplicationCardHeader
			className="rounded-control bg-background"
			{...application}
		/>
	)

export {
	ApplicationCard,
	type ApplicationCardFootnote,
	type ApplicationCardProps,
}
