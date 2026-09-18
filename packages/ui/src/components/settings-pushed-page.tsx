"use client"

import { Tabs } from "@base-ui/react/tabs"
import { type ComponentProps, type ReactNode, useState } from "react"

import {
	RAIL_LABELS_MIN_WIDTH,
	SettingsRail,
	SettingsRailBack,
	SettingsRailSeparator,
} from "@workspace/ui/components/settings-rail"
import { useIsNarrowerThan } from "@workspace/ui/hooks/use-is-narrower-than"
import { cn } from "@workspace/ui/lib/utils"

type SettingsPushedPageProps = Pick<
	ComponentProps<typeof Tabs.Root>,
	"value" | "defaultValue" | "onValueChange"
> & {
	backLabel: string
	onBack: () => void
	backClassName?: string
	isMeasured?: boolean
	rail: (iconsOnly: boolean) => ReactNode
	children: ReactNode
	className?: string
}

const SettingsPushedPage = ({
	backLabel,
	onBack,
	backClassName,
	isMeasured = false,
	rail,
	children,
	className,
	...tabs
}: SettingsPushedPageProps) => {
	const [root, setRoot] = useState<HTMLDivElement | null>(null)
	const iconsOnly = useIsNarrowerThan(
		isMeasured ? root : null,
		RAIL_LABELS_MIN_WIDTH,
	)

	return (
		<Tabs.Root
			{...tabs}
			className={cn("flex min-h-0 flex-1", className)}
			orientation="vertical"
			ref={setRoot}
		>
			<SettingsRail
				iconsOnly={iconsOnly}
				leading={
					<>
						<SettingsRailBack
							className={backClassName}
							iconsOnly={iconsOnly}
							label={backLabel}
							onClick={onBack}
						/>
						<SettingsRailSeparator />
					</>
				}
			>
				{rail(iconsOnly)}
			</SettingsRail>
			{children}
		</Tabs.Root>
	)
}

export { SettingsPushedPage, type SettingsPushedPageProps }
