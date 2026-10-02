"use client"

import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Icons } from "@workspace/ui/components/icons"
import { DANGER_BLOCK_CLASS } from "@workspace/ui/components/settings-styles"
import { buttonVariants } from "@workspace/ui/components/ui/button"

type DangerZoneProps = {
	actionLabel: string
	description: string
	confirmTitle: string
	onConfirm: () => void
	disabledReason?: string
	defaultConfirming?: boolean
	icon?: keyof typeof Icons
}

const DangerZone = ({
	actionLabel,
	description,
	confirmTitle,
	onConfirm,
	disabledReason,
	defaultConfirming,
	icon = "Delete",
}: DangerZoneProps) => {
	const Glyph = Icons[icon]

	return (
		<div className={DANGER_BLOCK_CLASS} data-slot="danger-zone">
			<div className="flex flex-col gap-1">
				<span className="font-medium text-destructive text-sm">
					{actionLabel}
				</span>
				<p className="text-muted-foreground text-sm">
					{disabledReason ?? description}
				</p>
			</div>
			<ConfirmDialog
				confirmLabel={actionLabel}
				defaultOpen={defaultConfirming}
				description={description}
				isTriggerDisabled={Boolean(disabledReason)}
				onConfirm={onConfirm}
				title={confirmTitle}
				trigger={
					<>
						<Glyph aria-hidden="true" className="size-3.5" />
						{actionLabel}
					</>
				}
				triggerClassName={buttonVariants({
					variant: "destructive",
					size: "sm",
				})}
			/>
		</div>
	)
}

export { DangerZone }
