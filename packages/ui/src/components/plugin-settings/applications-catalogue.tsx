"use client"

import { Tabs } from "@base-ui/react/tabs"
import { type ReactNode, useRef } from "react"
import { useTranslation } from "react-i18next"

import { type Icon, Icons } from "@workspace/ui/components/icons"
import { ApplicationMark } from "@workspace/ui/components/plugin-settings/application-mark"
import { ApplicationsSearchField } from "@workspace/ui/components/plugin-settings/applications-search-field"
import {
	RAIL_ITEM_CLASS,
	SETTINGS_PANEL_CLASS,
	SettingsRail,
	SettingsRailBack,
	SettingsRailSeparator,
} from "@workspace/ui/components/settings-rail"
import { Button } from "@workspace/ui/components/ui/button"
import { Skeleton } from "@workspace/ui/components/ui/skeleton"
import { useOverlayScrollbars } from "@workspace/ui/hooks/use-overlay-scrollbars"
import { cn } from "@workspace/ui/lib/utils"

type ApplicationSetup = "signIn" | "apiKey" | "none" | "unavailable"

type CatalogueApplication = {
	id: string
	name: string
	description?: string
	setup: ApplicationSetup
	mark?: string
	packageIdentity?: string
	source?: string
	useCount?: number
	isVerified?: boolean
	host?: string
}

const CATALOGUE_CATEGORIES = [
	"everything",
	"on-this-machine",
	"commerce-shopping",
	"communication",
	"consumer-health",
	"creative",
	"data-analytics",
	"developer-tools",
	"education",
	"financial-services",
	"health-life-sciences",
	"legal",
	"media-entertainment",
	"nonprofit",
	"productivity",
	"sales-marketing",
	"travel",
	"other",
] as const

type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number]

const EVERYTHING_CATEGORY: CatalogueCategory = "everything"

const HEADLESS_CATEGORIES: CatalogueCategory[] = [
	"everything",
	"on-this-machine",
]

const CATALOGUE_RAIL_ITEM_CLASS = cn(
	RAIL_ITEM_CLASS,
	"rounded-control text-sm/4.5",
)

const CATALOGUE_RAIL_BACK_CLASS =
	"rounded-control font-medium text-foreground text-sm/4.5"

const CARD_GRID_CLASS = "grid list-none grid-cols-3 gap-3 p-0"

const CARD_SHELL_CLASS =
	"flex h-full w-full min-w-0 flex-col gap-2 rounded-control border border-border p-3"

const SETUP_ICON = {
	signIn: Icons.ExternalLink,
	apiKey: Icons.Key,
	none: Icons.Check,
	unavailable: Icons.Blocked,
} as const satisfies Record<ApplicationSetup, Icon>

const SETUP_TONE = {
	signIn: undefined,
	apiKey: undefined,
	none: "text-state-connected",
	unavailable: "text-destructive",
} as const satisfies Record<ApplicationSetup, string | undefined>

type CatalogueCardProps = {
	application: CatalogueApplication
	onPick: () => void
}

const CatalogueCard = ({ application, onPick }: CatalogueCardProps) => {
	const { t } = useTranslation("bots")
	const SetupIcon = SETUP_ICON[application.setup]

	return (
		<li className="flex min-w-0">
			<button
				className={cn(
					CARD_SHELL_CLASS,
					"cursor-pointer text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
				)}
				onClick={onPick}
				type="button"
			>
				<span className="flex min-w-0 items-center gap-2">
					<ApplicationMark mark={application.mark} size="sm" />
					<span className="truncate font-medium text-foreground text-sm/4.5">
						{application.name}
					</span>
				</span>
				{application.description ? (
					<span
						className="line-clamp-2 h-8 wrap-break-word text-muted-foreground text-xs/4"
						data-slot="catalogue-card-description"
					>
						{application.description}
					</span>
				) : null}
				<span
					className="flex min-w-0 items-center gap-1.25 text-muted-foreground text-xs/4"
					data-slot="catalogue-card-setup"
				>
					<SetupIcon
						aria-hidden="true"
						className={cn("size-3.25 shrink-0", SETUP_TONE[application.setup])}
					/>
					<span className="truncate">
						{t(`applications.catalogue.setup.${application.setup}`)}
					</span>
				</span>
			</button>
		</li>
	)
}

type CatalogueCardsProps = {
	applications: CatalogueApplication[]
	onPick: (application: CatalogueApplication) => void
}

const CatalogueCards = ({ applications, onPick }: CatalogueCardsProps) => (
	<ul className={CARD_GRID_CLASS}>
		{applications.map((application) => (
			<CatalogueCard
				application={application}
				key={application.id}
				onPick={() => onPick(application)}
			/>
		))}
	</ul>
)

type SkeletonBarProps = {
	className: string
	isFaint?: boolean
}

const SkeletonBar = ({ className, isFaint = false }: SkeletonBarProps) => (
	<Skeleton
		className={cn(
			"rounded-sm motion-reduce:animate-none",
			isFaint ? "bg-border/60" : "bg-border",
			className,
		)}
	/>
)

const CARD_SKELETONS = [
	{ rank: "one", name: "w-16.5", description: "w-28", setup: "w-19.5" },
	{ rank: "two", name: "w-12", description: "w-34.5", setup: "w-16.5" },
	{ rank: "three", name: "w-18.5", description: "w-23", setup: "w-22.5" },
	{ rank: "four", name: "w-13.5", description: "w-31.5", setup: "w-18" },
	{ rank: "five", name: "w-15.5", description: "w-21", setup: "w-15" },
	{ rank: "six", name: "w-11", description: "w-32.5", setup: "w-21.5" },
]

const CatalogueCardSkeletons = () => (
	<ul aria-hidden="true" className={CARD_GRID_CLASS}>
		{CARD_SKELETONS.map((card) => (
			<li
				className="flex min-w-0"
				data-slot="catalogue-card-skeleton"
				key={card.rank}
			>
				<div className={CARD_SHELL_CLASS}>
					<div className="flex h-7 items-center gap-2">
						<Skeleton className="size-7 shrink-0 rounded-md bg-border motion-reduce:animate-none" />
						<SkeletonBar className={cn("h-3", card.name)} />
					</div>
					<div className="flex h-8 flex-col justify-center gap-1.5">
						<SkeletonBar className="h-2.25 w-full" isFaint />
						<SkeletonBar className={cn("h-2.25", card.description)} isFaint />
					</div>
					<div className="flex h-4 items-center gap-1.25">
						<SkeletonBar className="size-3.25 shrink-0" isFaint />
						<SkeletonBar className={cn("h-2.25", card.setup)} isFaint />
					</div>
				</div>
			</li>
		))}
	</ul>
)

type CatalogueLineProps = {
	icon: Icon
	text: string
	action?: ReactNode
}

const CatalogueLine = ({
	icon: LineIcon,
	text,
	action,
}: CatalogueLineProps) => (
	<div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
		<LineIcon
			aria-hidden="true"
			className="size-4 shrink-0 text-muted-foreground"
		/>
		<p
			aria-live="polite"
			className="min-w-0 flex-1 wrap-break-word text-muted-foreground text-sm"
		>
			{text}
		</p>
		{action}
	</div>
)

type CataloguePageProps = {
	category: CatalogueCategory
	onCategoryChange: (category: CatalogueCategory) => void
	onBack: () => void
	className?: string
	children: ReactNode
}

const CataloguePage = ({
	category,
	onCategoryChange,
	onBack,
	className,
	children,
}: CataloguePageProps) => {
	const { t } = useTranslation("bots")

	return (
		<Tabs.Root
			className={cn("flex min-h-0 min-w-0 flex-1", className)}
			onValueChange={(value) => onCategoryChange(value as CatalogueCategory)}
			orientation="vertical"
			value={category}
		>
			<SettingsRail
				iconsOnly={false}
				leading={
					<>
						<SettingsRailBack
							className={CATALOGUE_RAIL_BACK_CLASS}
							iconsOnly={false}
							label={t("applications.back")}
							onClick={onBack}
						/>
						<SettingsRailSeparator />
					</>
				}
			>
				{CATALOGUE_CATEGORIES.map((id) => (
					<Tabs.Tab className={CATALOGUE_RAIL_ITEM_CLASS} key={id} value={id}>
						<span className="min-w-0 flex-1 wrap-break-word text-start">
							{t(`applications.catalogue.category.${id}`)}
						</span>
					</Tabs.Tab>
				))}
			</SettingsRail>
			{children}
		</Tabs.Root>
	)
}

type CatalogueSectionHeadProps = {
	category: CatalogueCategory
}

const CatalogueSectionHead = ({ category }: CatalogueSectionHeadProps) => {
	const { t } = useTranslation("bots")

	return (
		<div className="flex flex-wrap items-baseline gap-x-2">
			<h3 className="font-medium text-foreground text-sm/4.5">
				{t(`applications.catalogue.category.${category}`)}
			</h3>
			<p className="text-muted-foreground text-xs/4">
				{t("applications.catalogue.directory")}
			</p>
		</div>
	)
}

type ApplicationsCatalogueProps = Omit<CataloguePageProps, "children"> & {
	query: string
	onQueryChange: (query: string) => void
	applications: CatalogueApplication[]
	isLoading?: boolean
	hasFailed?: boolean
	hasPartlyFailed?: boolean
	onRetry: () => void
	onPick: (application: CatalogueApplication) => void
}

const ApplicationsCatalogue = ({
	category,
	onCategoryChange,
	query,
	onQueryChange,
	applications,
	isLoading = false,
	hasFailed = false,
	hasPartlyFailed = false,
	onRetry,
	onPick,
	onBack,
	className,
}: ApplicationsCatalogueProps) => {
	const { t } = useTranslation("bots")
	const panel = useRef<HTMLDivElement>(null)
	useOverlayScrollbars(panel)
	const typed = query.trim()

	const retry = (
		<Button onClick={onRetry} size="xs" variant="outline">
			{t("applications.catalogue.retry")}
		</Button>
	)

	const results = () => {
		if (applications.length > 0) {
			return <CatalogueCards applications={applications} onPick={onPick} />
		}

		return (
			<CatalogueLine
				icon={Icons.Search}
				text={
					typed === ""
						? t("applications.catalogue.empty")
						: t("applications.catalogue.nothing", { query: typed })
				}
			/>
		)
	}

	const body = () => {
		if (isLoading) {
			return <CatalogueCardSkeletons />
		}

		if (hasFailed) {
			return (
				<CatalogueLine
					action={retry}
					icon={Icons.Alert}
					text={t("applications.catalogue.failed")}
				/>
			)
		}

		return (
			<>
				{hasPartlyFailed ? (
					<CatalogueLine
						action={retry}
						icon={Icons.Alert}
						text={t("applications.catalogue.partlyFailed")}
					/>
				) : null}
				{results()}
			</>
		)
	}

	return (
		<CataloguePage
			category={category}
			className={className}
			onBack={onBack}
			onCategoryChange={onCategoryChange}
		>
			<Tabs.Panel
				aria-busy={isLoading}
				className={cn(SETTINGS_PANEL_CLASS, "gap-3.5 overflow-y-auto")}
				ref={panel}
				value={category}
			>
				<div className="flex shrink-0 items-center">
					<ApplicationsSearchField
						onValueChange={onQueryChange}
						value={query}
					/>
				</div>
				<section className="flex shrink-0 flex-col gap-2">
					{HEADLESS_CATEGORIES.includes(category) ? null : (
						<CatalogueSectionHead category={category} />
					)}
					{body()}
				</section>
			</Tabs.Panel>
			{isLoading ? (
				<span className="sr-only" role="status">
					{t("applications.catalogue.loading")}
				</span>
			) : null}
		</CataloguePage>
	)
}

export {
	type ApplicationSetup,
	ApplicationsCatalogue,
	type ApplicationsCatalogueProps,
	CATALOGUE_CATEGORIES,
	type CatalogueApplication,
	type CatalogueCategory,
	CataloguePage,
	type CataloguePageProps,
	EVERYTHING_CATEGORY,
}
