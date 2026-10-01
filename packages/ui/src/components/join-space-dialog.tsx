"use client"

import { Dialog } from "@base-ui/react/dialog"
import { type FormEvent, useId, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	DIALOG_BACKDROP_CLASS,
	DIALOG_POPUP_CLASS,
	FIELD_CONTROL_CLASS,
	FIELD_CONTROL_INVALID_CLASS,
	FIELD_CONTROL_READONLY_CLASS,
	FIELD_LABEL_CLASS,
} from "@workspace/ui/components/settings-styles"
import { Button, buttonVariants } from "@workspace/ui/components/ui/button"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

type JoinSpaceState = "idle" | "joining" | "invalidLink" | "hostUnreachable"

type JoinSpaceDialogProps = {
	link: string
	onLinkChange: (link: string) => void
	state: JoinSpaceState
	onJoin: () => void
	open: boolean
	onOpenChange: (open: boolean) => void
}

const MESSAGE_KEYS = {
	invalidLink: "spaces.join.invalidLink",
	hostUnreachable: "spaces.join.hostUnreachable",
} as const

const JoinSpaceDialog = ({
	link,
	onLinkChange,
	state,
	onJoin,
	open,
	onOpenChange,
}: JoinSpaceDialogProps) => {
	const { t } = useTranslation("common")
	const control = useRef<HTMLInputElement>(null)
	const controlId = useId()
	const messageId = useId()
	const isJoining = state === "joining"
	const isInvalid = state === "invalidLink"
	const isEmpty = link.trim() === ""
	const messageKey =
		state === "invalidLink" || state === "hostUnreachable"
			? MESSAGE_KEYS[state]
			: undefined

	const change = (next: boolean) => {
		if (isJoining) return
		onOpenChange(next)
	}

	const join = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (isJoining || isEmpty) return
		onJoin()
	}

	return (
		<Dialog.Root onOpenChange={change} open={open}>
			<Dialog.Portal>
				<Dialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
				<Dialog.Popup
					className={cn(
						DIALOG_POPUP_CLASS,
						"-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-88 max-w-[calc(100vw-3rem)] rounded-2xl p-5",
					)}
					initialFocus={control}
				>
					<form className="flex flex-col gap-4" onSubmit={join}>
						<div className="flex flex-col gap-1">
							<Dialog.Title className="text-base">
								{t("spaces.join.title")}
							</Dialog.Title>
							<Dialog.Description className="text-pretty text-muted-foreground text-sm">
								{t("spaces.join.description")}
							</Dialog.Description>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5">
							<label className={FIELD_LABEL_CLASS} htmlFor={controlId}>
								{t("spaces.join.label")}
							</label>
							<input
								aria-describedby={messageKey ? messageId : undefined}
								aria-invalid={isInvalid || undefined}
								className={cn(
									FIELD_CONTROL_CLASS,
									"truncate",
									isInvalid && [
										FIELD_CONTROL_INVALID_CLASS,
										"ring-3 ring-destructive/30",
									],
									isJoining && FIELD_CONTROL_READONLY_CLASS,
								)}
								id={controlId}
								onChange={(event) => onLinkChange(event.target.value)}
								placeholder={t("spaces.join.placeholder")}
								readOnly={isJoining}
								ref={control}
								spellCheck={false}
								value={link}
							/>
							{messageKey ? (
								<p
									className="text-destructive text-xs"
									id={messageId}
									role="alert"
								>
									{t(messageKey)}
								</p>
							) : null}
						</div>
						<div className="flex justify-end gap-2">
							<Dialog.Close
								className={buttonVariants({ variant: "outline", size: "sm" })}
								disabled={isJoining}
							>
								{t("confirm.cancel")}
							</Dialog.Close>
							<Button disabled={isJoining || isEmpty} size="sm" type="submit">
								{isJoining ? (
									<Icons.Loading
										aria-hidden="true"
										className={cn(
											"size-3.5 animate-spin",
											STILL_UNDER_REDUCED_MOTION,
										)}
										data-icon="inline-start"
									/>
								) : null}
								{t(isJoining ? "spaces.join.joining" : "spaces.join.action")}
							</Button>
						</div>
					</form>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

export type { JoinSpaceState }
export { JoinSpaceDialog }
