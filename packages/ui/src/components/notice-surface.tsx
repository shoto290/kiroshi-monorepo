"use client"

import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import {
	createToastManager,
	Toast,
	ToastClose,
	ToastContent,
	ToastDescription,
	ToastPortal,
	ToastProvider,
	ToastTitle,
	ToastViewport,
	useToastManager,
} from "@workspace/ui/components/ui/toast"
import { cn } from "@workspace/ui/lib/utils"

const TRANSIENT_NOTICE_DELAY = 5000
const NOTICE_LIMIT = 3

const noticeManager = createToastManager()

type NoticeMessage = {
	title: string
	description?: string
}

const raiseTransientNotice = (message: NoticeMessage) => {
	noticeManager.add({ ...message, type: "transient", priority: "low" })
}

const raiseFailureNotice = (message: NoticeMessage) => {
	noticeManager.add({
		...message,
		type: "failure",
		priority: "high",
		timeout: 0,
	})
}

const NoticeList = () => {
	const { t } = useTranslation("common")
	const { toasts } = useToastManager()

	return toasts.map((notice) => {
		const hasFailed = notice.type === "failure"

		return (
			<Toast
				className={cn("pointer-events-auto", hasFailed && "border-destructive")}
				key={notice.id}
				swipeDirection={["down", "right"]}
				toast={notice}
			>
				<ToastContent>
					{hasFailed ? (
						<Icons.Alert
							aria-hidden="true"
							className="size-4 shrink-0 text-destructive"
						/>
					) : null}
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<ToastTitle className="break-words" />
						<ToastDescription className="break-words" />
					</div>
					<ToastClose
						render={
							<Button
								aria-label={t("notice.close")}
								size="icon-sm"
								variant="ghost"
							/>
						}
					/>
				</ToastContent>
			</Toast>
		)
	})
}

type NoticeSurfaceProps = {
	transientDelay?: number
}

const NoticeSurface = ({
	transientDelay = TRANSIENT_NOTICE_DELAY,
}: NoticeSurfaceProps) => {
	const { t } = useTranslation("common")

	return (
		<ToastProvider
			limit={NOTICE_LIMIT}
			timeout={transientDelay}
			toastManager={noticeManager}
		>
			<ToastPortal>
				<ToastViewport aria-label={t("notice.label")} className="z-100">
					<NoticeList />
				</ToastViewport>
			</ToastPortal>
		</ToastProvider>
	)
}

export {
	type NoticeMessage,
	NoticeSurface,
	type NoticeSurfaceProps,
	raiseFailureNotice,
	raiseTransientNotice,
	TRANSIENT_NOTICE_DELAY,
}
