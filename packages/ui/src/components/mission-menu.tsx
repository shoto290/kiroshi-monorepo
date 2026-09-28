"use client"

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import {
	cloneElement,
	type FormEvent,
	type ReactElement,
	type RefObject,
	useId,
	useRef,
	useState,
} from "react"
import { useTranslation } from "react-i18next"

import { ContextMenuPressTrigger } from "@workspace/ui/components/context-menu-press-trigger"
import { Icons } from "@workspace/ui/components/icons"
import type { MissionState } from "@workspace/ui/components/mission"
import type { MissionCardProps } from "@workspace/ui/components/mission-card"
import {
	FIELD_LABEL_CLASS,
	POPUP_CLASS,
} from "@workspace/ui/components/settings-styles"
import { Button } from "@workspace/ui/components/ui/button"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@workspace/ui/components/ui/context-menu"
import { Input } from "@workspace/ui/components/ui/input"
import { STILL_UNDER_REDUCED_MOTION } from "@workspace/ui/lib/reduced-motion"
import { cn, mergeRefs } from "@workspace/ui/lib/utils"

type MissionCopyKind =
	| "issue_id"
	| "branch"
	| "pull_request_url"
	| "workspace_path"

type MissionCloseOutcome = Extract<MissionState, "done" | "failed">

type MissionMenuActions = {
	onOpen: () => void
	onOpenTicket: () => void
	onOpenPullRequest: () => void
	onCopy: (kind: MissionCopyKind) => void
	onMessageAgent: () => void
	onStopAgent: () => void
	onAnswer: () => void
	onClose: (outcome: MissionCloseOutcome, summary: string) => void
	onReopen: () => void
}

type MissionMenuProps = MissionMenuActions & {
	state: MissionState
	hasPullRequest: boolean
	hasBranch: boolean
	hasWorkspacePath: boolean
	openShortcut: string
	closeShortcut: string
	children: ReactElement<MissionCardProps>
}

type MissionMenuContentProps = Omit<
	MissionMenuProps,
	"children" | "onClose"
> & {
	isConfirmingClose: boolean
	onChooseClose: (outcome: MissionCloseOutcome) => void
}

const ICON_CLASS = "size-3.5"

const CLOSE_OUTCOMES: MissionCloseOutcome[] = ["done", "failed"]

const isClosedState = (state: MissionState) =>
	state === "done" || state === "failed"

const isAgentRunning = (state: MissionState) =>
	state === "working" || state === "waiting_bot"

const copyKindsFor = ({
	hasBranch,
	hasPullRequest,
	hasWorkspacePath,
}: Pick<
	MissionMenuProps,
	"hasBranch" | "hasPullRequest" | "hasWorkspacePath"
>) => {
	const shown: Record<MissionCopyKind, boolean> = {
		issue_id: true,
		branch: hasBranch,
		pull_request_url: hasPullRequest,
		workspace_path: hasWorkspacePath,
	}
	return (Object.keys(shown) as MissionCopyKind[]).filter((kind) => shown[kind])
}

const MissionMenuContent = ({
	state,
	hasPullRequest,
	hasBranch,
	hasWorkspacePath,
	openShortcut,
	closeShortcut,
	isConfirmingClose,
	onOpen,
	onOpenTicket,
	onOpenPullRequest,
	onCopy,
	onMessageAgent,
	onStopAgent,
	onAnswer,
	onChooseClose,
	onReopen,
}: MissionMenuContentProps) => {
	const { t } = useTranslation("chat")

	return (
		<ContextMenuContent
			aria-label={t("missions.menu.label")}
			className={STILL_UNDER_REDUCED_MOTION}
			finalFocus={!isConfirmingClose}
		>
			<ContextMenuItem onClick={onOpen}>
				<Icons.ArrowRight aria-hidden="true" className={ICON_CLASS} />
				{t("missions.menu.open")}
				<ContextMenuShortcut>{openShortcut}</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onClick={onOpenTicket}>
				<Icons.ExternalLink aria-hidden="true" className={ICON_CLASS} />
				{t("missions.menu.openTicket")}
			</ContextMenuItem>
			{hasPullRequest ? (
				<ContextMenuItem onClick={onOpenPullRequest}>
					<Icons.ExternalLink aria-hidden="true" className={ICON_CLASS} />
					{t("missions.menu.openPullRequest")}
				</ContextMenuItem>
			) : null}
			<ContextMenuSub>
				<ContextMenuSubTrigger className="gap-2">
					<Icons.Copy aria-hidden="true" className={ICON_CLASS} />
					{t("missions.menu.copy")}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className={STILL_UNDER_REDUCED_MOTION}>
					{copyKindsFor({ hasBranch, hasPullRequest, hasWorkspacePath }).map(
						(kind) => (
							<ContextMenuItem key={kind} onClick={() => onCopy(kind)}>
								{t(`missions.menu.copyKind.${kind}`)}
							</ContextMenuItem>
						),
					)}
				</ContextMenuSubContent>
			</ContextMenuSub>
			{isAgentRunning(state) ? (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={onMessageAgent}>
						<Icons.Message aria-hidden="true" className={ICON_CLASS} />
						{t("missions.menu.messageAgent")}
					</ContextMenuItem>
					<ContextMenuItem onClick={onStopAgent}>
						<Icons.Stop aria-hidden="true" className={ICON_CLASS} />
						{t("missions.menu.stopAgent")}
					</ContextMenuItem>
				</>
			) : null}
			{state === "waiting_human" ? (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={onAnswer}>
						<Icons.Reply aria-hidden="true" className={ICON_CLASS} />
						{t("missions.menu.answer")}
					</ContextMenuItem>
				</>
			) : null}
			<ContextMenuSeparator />
			{isClosedState(state) ? (
				<ContextMenuItem onClick={onReopen}>
					<Icons.Restart aria-hidden="true" className={ICON_CLASS} />
					{t("missions.menu.reopen")}
				</ContextMenuItem>
			) : (
				<ContextMenuSub>
					<ContextMenuSubTrigger className="gap-2">
						<Icons.Check aria-hidden="true" className={ICON_CLASS} />
						<span className="flex-1">{t("missions.menu.close")}</span>
						<ContextMenuShortcut>{closeShortcut}</ContextMenuShortcut>
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className={STILL_UNDER_REDUCED_MOTION}>
						{CLOSE_OUTCOMES.map((outcome) => (
							<ContextMenuItem
								key={outcome}
								onClick={() => onChooseClose(outcome)}
							>
								{t(`missions.menu.closeAs.${outcome}`)}
							</ContextMenuItem>
						))}
					</ContextMenuSubContent>
				</ContextMenuSub>
			)}
		</ContextMenuContent>
	)
}

type MissionClosePopoverProps = {
	anchor: RefObject<HTMLElement | null>
	outcome: MissionCloseOutcome
	isOpen: boolean
	onDismiss: () => void
	onConfirm: (outcome: MissionCloseOutcome, summary: string) => void
}

const MissionClosePopover = ({
	anchor,
	outcome,
	isOpen,
	onDismiss,
	onConfirm,
}: MissionClosePopoverProps) => {
	const { t } = useTranslation("chat")
	const [summary, setSummary] = useState("")
	const summaryId = useId()

	const confirm = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onConfirm(outcome, summary)
	}

	return (
		<PopoverPrimitive.Root
			modal={false}
			onOpenChange={(next) => {
				if (!next) onDismiss()
			}}
			onOpenChangeComplete={(next) => {
				if (!next) setSummary("")
			}}
			open={isOpen}
		>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="end"
					anchor={anchor}
					className="isolate z-50"
					side="bottom"
					sideOffset={4}
				>
					<PopoverPrimitive.Popup
						className={cn(
							POPUP_CLASS,
							"w-72 max-w-[92vw] origin-(--transform-origin) rounded-2xl p-4 transition-[scale,opacity] duration-150 ease-out data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:duration-[0.01ms]",
						)}
						data-slot="mission-close-popover"
					>
						<form className="flex flex-col gap-3" onSubmit={confirm}>
							<PopoverPrimitive.Title className="font-medium text-sm">
								{t(`missions.menu.closeAs.${outcome}`)}
							</PopoverPrimitive.Title>
							<span className="flex flex-col gap-1.5">
								<label className={FIELD_LABEL_CLASS} htmlFor={summaryId}>
									{t("missions.close.summary")}
								</label>
								<Input
									id={summaryId}
									onChange={(event) => setSummary(event.target.value)}
									placeholder={t("missions.close.summaryPlaceholder")}
									value={summary}
								/>
							</span>
							<Button className="self-end" size="sm" type="submit">
								{t("missions.close.confirm")}
							</Button>
						</form>
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	)
}

const MissionMenuButton = () => {
	const { t } = useTranslation("chat")

	return (
		<ContextMenuPressTrigger
			render={
				<Button
					aria-label={t("missions.menu.label")}
					size="icon-xs"
					variant="ghost"
				>
					<Icons.More aria-hidden="true" />
				</Button>
			}
		/>
	)
}

const MissionMenu = ({ children, onClose, ...props }: MissionMenuProps) => {
	const cardRef = useRef<HTMLElement>(null)
	const [outcome, setOutcome] = useState<MissionCloseOutcome>("done")
	const [isConfirmingClose, setIsConfirmingClose] = useState(false)

	const chooseClose = (chosen: MissionCloseOutcome) => {
		setOutcome(chosen)
		setIsConfirmingClose(true)
	}

	const confirmClose = (chosen: MissionCloseOutcome, summary: string) => {
		setIsConfirmingClose(false)
		onClose(chosen, summary)
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuPrimitive.Trigger
					render={({ ref, ...surface }) =>
						cloneElement(children, {
							menu: <MissionMenuButton />,
							surface: { ...surface, ref: mergeRefs(ref, cardRef) },
						})
					}
				/>
				<MissionMenuContent
					{...props}
					isConfirmingClose={isConfirmingClose}
					onChooseClose={chooseClose}
				/>
			</ContextMenu>
			<MissionClosePopover
				anchor={cardRef}
				isOpen={isConfirmingClose}
				onConfirm={confirmClose}
				onDismiss={() => setIsConfirmingClose(false)}
				outcome={outcome}
			/>
		</>
	)
}

export {
	type MissionCloseOutcome,
	type MissionCopyKind,
	MissionMenu,
	type MissionMenuProps,
}
