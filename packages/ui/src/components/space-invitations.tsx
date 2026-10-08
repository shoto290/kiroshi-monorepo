"use client"

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import {
	type BotAvatarBlot,
	blotTint,
} from "@workspace/ui/components/companion-colour"
import { Icons } from "@workspace/ui/components/icons"
import { buttonVariants } from "@workspace/ui/components/ui/button"
import {
	ContextMenuGroup,
	ContextMenuLabel,
	ContextMenuSeparator,
} from "@workspace/ui/components/ui/context-menu"
import { cn } from "@workspace/ui/lib/utils"

const GROUP_LABEL = "pt-1.5 pb-0.5"

const INVITATION = "flex flex-col gap-2 px-2 pt-1.5 pb-2"

const HEADING = "flex items-start gap-2"

const RING =
	"mt-1.25 size-2.5 shrink-0 rounded-full inset-ring-[1.5px] inset-ring-current"

const RING_MUTED = "text-foreground/30"

const TEXT = "flex min-w-0 flex-col"

const NAME = "break-words text-foreground text-sm"

const NAME_WITHDRAWN = "text-muted-foreground"

const HOST = "break-words text-muted-foreground text-xs"

const INDENTED = "ps-4.5"

const CAUSE = "flex items-start gap-1.5 break-words text-destructive text-xs"

const CAUSE_ICON = "size-3.5 shrink-0"

const ACTIONS = "flex gap-2"

const ACTION = "h-7 rounded-control px-3 text-compact"

const PRIMARY_BUSY = "data-disabled:opacity-70"

const SECONDARY_BUSY = "data-disabled:opacity-50"

type SpaceInvitationFailure = "servers" | "offline"

type SpaceInvitationState =
	| { state: "waiting" | "accepting" | "withdrawn" }
	| { state: "failed"; failure: SpaceInvitationFailure }

type SpaceInvitation = SpaceInvitationState & {
	id: string
	name: string
	colour?: BotAvatarBlot | null
	hostEmail: string
}

type SpaceInvitationCallbacks = {
	onAcceptInvitation?: (id: string) => void
	onDeclineInvitation?: (id: string) => void
	onRetryInvitation?: (id: string) => void
}

type SpaceInvitationRowProps = SpaceInvitationCallbacks & {
	invitation: SpaceInvitation
}

const SpaceInvitationRow = ({
	invitation,
	onAcceptInvitation,
	onDeclineInvitation,
	onRetryInvitation,
}: SpaceInvitationRowProps) => {
	const { t } = useTranslation("bots")
	const nameId = useId()
	const causeId = useId()
	const { id, name, colour, hostEmail } = invitation
	const isWithdrawn = invitation.state === "withdrawn"
	const isAccepting = invitation.state === "accepting"
	const isFailed = invitation.state === "failed"
	const tint = !isWithdrawn && colour ? blotTint(colour) : undefined

	const cause =
		invitation.state === "failed"
			? t(`spaces.invitations.failed.${invitation.failure}`)
			: isWithdrawn
				? t("spaces.invitations.withdrawn", { email: hostEmail })
				: null

	return (
		<div
			aria-busy={isAccepting}
			aria-describedby={cause ? causeId : undefined}
			aria-labelledby={nameId}
			className={INVITATION}
			data-slot="space-invitation"
			data-state={invitation.state}
			role="group"
		>
			<div className={HEADING}>
				<span
					aria-hidden="true"
					className={cn(RING, !tint && RING_MUTED)}
					data-slot="space-invitation-ring"
					style={tint ? { color: tint } : undefined}
				/>
				<div className={TEXT}>
					<span className={cn(NAME, isWithdrawn && NAME_WITHDRAWN)} id={nameId}>
						{name}
					</span>
					<span className={HOST}>
						{t("spaces.invitations.invitedBy", { email: hostEmail })}
					</span>
				</div>
			</div>
			{cause ? (
				<p
					className={cn(CAUSE, INDENTED)}
					data-slot="space-invitation-cause"
					id={causeId}
				>
					<Icons.Alert aria-hidden="true" className={CAUSE_ICON} />
					{cause}
				</p>
			) : null}
			{isWithdrawn ? null : (
				<div className={cn(ACTIONS, INDENTED)}>
					<ContextMenuPrimitive.Item
						aria-describedby={isFailed ? causeId : undefined}
						className={cn(buttonVariants({ size: "sm" }), ACTION, PRIMARY_BUSY)}
						closeOnClick={false}
						disabled={isAccepting}
						nativeButton
						onClick={() =>
							isFailed ? onRetryInvitation?.(id) : onAcceptInvitation?.(id)
						}
						render={<button type="button" />}
					>
						<span role="status">
							{t(
								isAccepting
									? "spaces.invitations.joining"
									: isFailed
										? "spaces.invitations.retry"
										: "spaces.invitations.accept",
							)}
						</span>
					</ContextMenuPrimitive.Item>
					<ContextMenuPrimitive.Item
						className={cn(
							buttonVariants({ size: "sm", variant: "outline" }),
							ACTION,
							SECONDARY_BUSY,
						)}
						disabled={isAccepting}
						nativeButton
						onClick={() => onDeclineInvitation?.(id)}
						render={<button type="button" />}
					>
						{t("spaces.invitations.decline")}
					</ContextMenuPrimitive.Item>
				</div>
			)}
		</div>
	)
}

type SpaceInvitationsProps = SpaceInvitationCallbacks & {
	invitations: SpaceInvitation[]
}

const SpaceInvitations = ({
	invitations,
	...callbacks
}: SpaceInvitationsProps) => {
	const { t } = useTranslation("bots")

	if (invitations.length === 0) return null

	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuGroup data-slot="space-invitations">
				<ContextMenuLabel className={GROUP_LABEL}>
					{t("spaces.invitations.label")}
				</ContextMenuLabel>
				{invitations.map((invitation) => (
					<SpaceInvitationRow
						invitation={invitation}
						key={invitation.id}
						{...callbacks}
					/>
				))}
			</ContextMenuGroup>
		</>
	)
}

export {
	type SpaceInvitation,
	type SpaceInvitationCallbacks,
	type SpaceInvitationFailure,
	SpaceInvitations,
}
