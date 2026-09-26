import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import { BotAvatar } from "@workspace/ui/components/bot-avatar"
import { usePrefersReducedMotion } from "@workspace/ui/hooks/use-prefers-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

const BOOT_MARK_SIZE = 96

type AppBootScreenProps = Omit<ComponentProps<"div">, "children">

function AppBootScreen({ className, ...props }: AppBootScreenProps) {
	const { t } = useTranslation("common")
	const prefersReducedMotion = usePrefersReducedMotion()
	const status = t("boot.status")

	return (
		<div
			data-slot="app-boot-screen"
			className={cn(
				"flex h-svh w-full flex-col items-center justify-center bg-background",
				className,
			)}
			{...props}
		>
			<BotAvatar animal="rabbit" size={BOOT_MARK_SIZE} state="working" />
			{prefersReducedMotion ? (
				<p className="mt-6 text-muted-foreground text-sm" role="status">
					{status}
				</p>
			) : (
				<span className="sr-only" role="status">
					{status}
				</span>
			)}
		</div>
	)
}

export { AppBootScreen, type AppBootScreenProps, BOOT_MARK_SIZE }
