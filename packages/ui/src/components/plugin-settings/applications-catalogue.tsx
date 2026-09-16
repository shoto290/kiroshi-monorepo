"use client"

import { Tabs } from "@base-ui/react/tabs"
import { type ReactNode, useRef } from "react"
import { useTranslation } from "react-i18next"

import { type Icon, Icons } from "@workspace/ui/components/icons"
import {
	ApplicationMetaLine,
	ApplicationVerifiedPill,
} from "@workspace/ui/components/plugin-settings/application-identity"
import { ApplicationMark } from "@workspace/ui/components/plugin-settings/application-mark"
import {
	RAIL_ITEM_CLASS,
	SETTINGS_PANEL_CLASS,
	SettingsRail,
	SettingsRailAction,
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

type ApplicationCategory = {
	id: string
	label: string
	count?: number | null
}

const UNKNOWN_COUNT = "\u2014"

const CARD_SLOT_CLASS = "flex w-46.5 shrink-0"

const CARD_SHELL_CLASS =
	"flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border p-3"

const ROW_LIST_CLASS = "flex list-none flex-col gap-2 p-0"

const ROW_SHELL_CLASS =
	"flex w-full min-w-0 items-start gap-2.5 rounded-lg border border-border p-3"

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
		<li className={CARD_SLOT_CLASS}>
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
					<span className="truncate font-medium text-foreground text-sm">
						{application.name}
					</span>
				</span>
				<span className="flex-1 wrap-break-word text-muted-foreground text-xs/4">
					{application.description}
				</span>
				<span
					className="flex min-w-0 items-center gap-1.25 pt-2 text-muted-foreground text-xs"
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
	<ul className="flex list-none flex-wrap gap-3 p-0">
		{applications.map((application) => (
			<CatalogueCard
				application={application}
				key={application.id}
				onPick={() => onPick(application)}
			/>
		))}
	</ul>
)

type CatalogueRowProps = {
	application: CatalogueApplication
	onPick: () => void
}

const CatalogueRow = ({ application, onPick }: CatalogueRowProps) => {
	const { t } = useTranslation("bots")
	const SetupIcon = SETUP_ICON[application.setup]

	return (
		<li className="flex">
			<button
				className={cn(
					ROW_SHELL_CLASS,
					"group cursor-pointer text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
				)}
				onClick={onPick}
				type="button"
			>
				<ApplicationMark mark={application.mark} size="sm" />
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						className="flex h-4.5 min-w-0 items-center gap-1.5"
						data-slot="catalogue-row-name"
					>
						<span className="truncate font-medium text-[13px]/4.5 text-foreground">
							{application.name}
						</span>
						{application.isVerified ? <ApplicationVerifiedPill /> : null}
					</span>
					{application.description ? (
						<span
							className="h-4 truncate text-muted-foreground text-xs/4"
							data-slot="catalogue-row-description"
						>
							{application.description}
						</span>
					) : null}
					<ApplicationMetaLine
						host={application.host}
						packageIdentity={application.packageIdentity}
						source={application.source}
						useCount={application.useCount}
					/>
				</span>
				<span className="flex shrink-0 items-center gap-1.25 pt-px text-muted-foreground text-xs/4">
					<SetupIcon
						aria-hidden="true"
						className={cn("size-3.25 shrink-0", SETUP_TONE[application.setup])}
					/>
					{t(`applications.catalogue.setup.${application.setup}`)}
				</span>
			</button>
		</li>
	)
}

const CatalogueRows = ({ applications, onPick }: CatalogueCardsProps) => (
	<ul className={ROW_LIST_CLASS}>
		{applications.map((application) => (
			<CatalogueRow
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

type SkeletonLineProps = {
	line: string
	bar: string
	isFaint?: boolean
}

const SkeletonLine = ({ line, bar, isFaint = false }: SkeletonLineProps) => (
	<div className={cn("flex items-center", line)}>
		<SkeletonBar className={bar} isFaint={isFaint} />
	</div>
)

const SkeletonMark = () => (
	<Skeleton className="size-7 shrink-0 rounded-md bg-border motion-reduce:animate-none" />
)

const CARD_SKELETONS = [
	{ rank: "one", name: "w-16.5", description: "w-28", setup: "w-19.5" },
	{ rank: "two", name: "w-12", description: "w-34.5", setup: "w-16.5" },
	{ rank: "three", name: "w-18.5", description: "w-23", setup: "w-22.5" },
	{ rank: "four", name: "w-13.5", description: "w-31.5", setup: "w-18" },
	{ rank: "five", name: "w-15.5", description: "w-21", setup: "w-15" },
	{ rank: "six", name: "w-11", description: "w-32.5", setup: "w-21.5" },
]

const ROW_SKELETONS = [
	{
		rank: "one",
		name: "w-33",
		description: "w-51.5",
		meta: "w-39.5",
		setup: "w-24.5",
	},
	{
		rank: "two",
		name: "w-24",
		description: "w-43",
		meta: "w-29.5",
		setup: "w-20.5",
	},
	{
		rank: "three",
		name: "w-37",
		description: "w-56",
		meta: "w-47.5",
		setup: "w-17.5",
	},
]

const CatalogueCardSkeletons = () => (
	<ul aria-hidden="true" className="flex list-none flex-wrap gap-3 p-0">
		{CARD_SKELETONS.map((card) => (
			<li
				className={CARD_SLOT_CLASS}
				data-slot="catalogue-card-skeleton"
				key={card.rank}
			>
				<div className={CARD_SHELL_CLASS}>
					<div className="flex items-center gap-2">
						<SkeletonMark />
						<SkeletonBar className={cn("h-3", card.name)} />
					</div>
					<div className="flex flex-1 flex-col gap-1.5 pt-0.5">
						<SkeletonBar className="h-2.25 w-40" />
						<SkeletonBar className={cn("h-2.25", card.description)} isFaint />
					</div>
					<div className="flex items-center gap-1.25 pt-2">
						<SkeletonBar className="size-3.25 shrink-0" isFaint />
						<SkeletonBar className={cn("h-2.25", card.setup)} isFaint />
					</div>
				</div>
			</li>
		))}
	</ul>
)

const CatalogueRowSkeletons = () => (
	<ul aria-hidden="true" className={ROW_LIST_CLASS}>
		{ROW_SKELETONS.map((row) => (
			<li className="flex" data-slot="catalogue-row-skeleton" key={row.rank}>
				<div className={ROW_SHELL_CLASS}>
					<SkeletonMark />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<SkeletonLine bar={cn("h-2.75", row.name)} line="h-4.5" />
						<SkeletonLine
							bar={cn("h-2.25", row.description)}
							isFaint
							line="h-4"
						/>
						<SkeletonLine bar={cn("h-2.25", row.meta)} isFaint line="h-4" />
					</div>
					<div className="shrink-0 pt-px">
						<SkeletonLine bar={cn("h-2.25", row.setup)} isFaint line="h-4" />
					</div>
				</div>
			</li>
		))}
	</ul>
)

type CatalogueSectionProps = {
	title: string
	subtitle: string
	children: ReactNode
}

const CatalogueSection = ({
	title,
	subtitle,
	children,
}: CatalogueSectionProps) => (
	<section className="flex shrink-0 flex-col gap-2">
		<div className="flex flex-wrap items-baseline gap-x-2 px-2">
			<h3 className="font-medium text-foreground text-sm">{title}</h3>
			<p className="text-muted-foreground text-xs">{subtitle}</p>
		</div>
		{children}
	</section>
)

type CatalogueLineProps = {
	icon: Icon
	text: string
	isAnnounced?: boolean
	action?: ReactNode
}

const CatalogueLine = ({
	icon: LineIcon,
	text,
	isAnnounced = false,
	action,
}: CatalogueLineProps) => (
	<div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
		<LineIcon
			aria-hidden="true"
			className="size-4 shrink-0 text-muted-foreground"
		/>
		<p
			aria-live={isAnnounced ? "polite" : "off"}
			className="min-w-0 flex-1 wrap-break-word text-muted-foreground text-sm"
		>
			{text}
		</p>
		{action}
	</div>
)

type CataloguePageProps = {
	categories: ApplicationCategory[]
	category: string
	onCategoryChange: (category: string) => void
	onBack: () => void
	onPaste: () => void
	className?: string
	children: ReactNode
}

const CataloguePage = ({
	categories,
	category,
	onCategoryChange,
	onBack,
	onPaste,
	className,
	children,
}: CataloguePageProps) => {
	const { t } = useTranslation("bots")

	return (
		<Tabs.Root
			className={cn("flex min-h-0 min-w-0 flex-1", className)}
			onValueChange={onCategoryChange}
			orientation="vertical"
			value={category}
		>
			<SettingsRail
				iconsOnly={false}
				leading={
					<>
						<SettingsRailBack
							iconsOnly={false}
							label={t("applications.back")}
							onClick={onBack}
						/>
						<SettingsRailSeparator />
					</>
				}
				trailing={
					<>
						<SettingsRailSeparator />
						<SettingsRailAction
							icon={Icons.Json}
							iconsOnly={false}
							label={t("applications.paste")}
							onClick={onPaste}
						/>
					</>
				}
			>
				{categories.map((entry) => (
					<Tabs.Tab className={RAIL_ITEM_CLASS} key={entry.id} value={entry.id}>
						<span className="min-w-0 flex-1 wrap-break-word text-start">
							{entry.label}
						</span>
						{entry.count === undefined ? null : (
							<span
								aria-hidden={entry.count === null}
								className="shrink-0 text-muted-foreground text-xs tabular-nums"
							>
								{entry.count ?? UNKNOWN_COUNT}
							</span>
						)}
					</Tabs.Tab>
				))}
			</SettingsRail>
			{children}
		</Tabs.Root>
	)
}

type ApplicationsCatalogueProps = Omit<CataloguePageProps, "children"> & {
	query: string
	onQueryChange: (query: string) => void
	curated: CatalogueApplication[]
	registry: CatalogueApplication[]
	publishedCount?: number
	isCatalogueLoading?: boolean
	isRegistrySearching?: boolean
	hasRegistryFailed?: boolean
	hasRegistryPartlyFailed?: boolean
	onRegistryRetry: () => void
	onPick: (application: CatalogueApplication) => void
	onBack: () => void
	onPaste: () => void
	className?: string
}

const ApplicationsCatalogue = ({
	categories,
	category,
	onCategoryChange,
	query,
	onQueryChange,
	curated,
	registry,
	publishedCount,
	isCatalogueLoading = false,
	isRegistrySearching = false,
	hasRegistryFailed = false,
	hasRegistryPartlyFailed = false,
	onRegistryRetry,
	onPick,
	onBack,
	onPaste,
	className,
}: ApplicationsCatalogueProps) => {
	const { t } = useTranslation("bots")
	const panel = useRef<HTMLDivElement>(null)
	useOverlayScrollbars(panel)
	const typed = query.trim()
	const placeholder = t("applications.catalogue.search.placeholder")
	const isLoading = isCatalogueLoading || isRegistrySearching

	const registryRetry = (
		<Button onClick={onRegistryRetry} size="xs" variant="outline">
			{t("applications.catalogue.registry.retry")}
		</Button>
	)

	const registryPartialFailure = () =>
		hasRegistryPartlyFailed ? (
			<CatalogueLine
				action={registryRetry}
				icon={Icons.Alert}
				isAnnounced
				text={t("applications.catalogue.registry.partlyFailed")}
			/>
		) : null

	const registryBody = () => {
		if (isLoading) {
			return <CatalogueRowSkeletons />
		}

		if (typed === "") {
			return (
				<CatalogueLine
					icon={Icons.Search}
					text={
						publishedCount === undefined
							? t("applications.catalogue.registry.rest")
							: t("applications.catalogue.registry.restCounted", {
									count: publishedCount,
								})
					}
				/>
			)
		}

		if (hasRegistryFailed) {
			return (
				<CatalogueLine
					action={registryRetry}
					icon={Icons.Alert}
					isAnnounced
					text={t("applications.catalogue.registry.failed")}
				/>
			)
		}

		return (
			<>
				{registry.length > 0 ? (
					<CatalogueRows applications={registry} onPick={onPick} />
				) : (
					<CatalogueLine
						icon={Icons.Search}
						isAnnounced
						text={
							curated.length === 0
								? t("applications.catalogue.nothing", { query: typed })
								: t("applications.catalogue.registry.empty", { query: typed })
						}
					/>
				)}
				{registryPartialFailure()}
			</>
		)
	}

	return (
		<CataloguePage
			categories={categories}
			category={category}
			className={className}
			onBack={onBack}
			onCategoryChange={onCategoryChange}
			onPaste={onPaste}
		>
			<Tabs.Panel
				aria-busy={isLoading}
				className={cn(SETTINGS_PANEL_CLASS, "gap-3.5 overflow-y-auto")}
				ref={panel}
				value={category}
			>
				<label className="flex min-h-9 shrink-0 items-center gap-2 rounded-xl border border-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
					<Icons.Search
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground"
					/>
					<input
						aria-label={placeholder}
						className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder={placeholder}
						type="text"
						value={query}
					/>
					<span className="min-w-0 truncate text-muted-foreground text-xs">
						{t("applications.catalogue.search.hint")}
					</span>
				</label>
				{isCatalogueLoading || curated.length > 0 ? (
					<CatalogueSection
						subtitle={t("applications.catalogue.curated.subtitle")}
						title={t("applications.catalogue.curated.title")}
					>
						{isCatalogueLoading ? (
							<CatalogueCardSkeletons />
						) : (
							<CatalogueCards applications={curated} onPick={onPick} />
						)}
					</CatalogueSection>
				) : null}
				<CatalogueSection
					subtitle={t("applications.catalogue.registry.subtitle")}
					title={t("applications.catalogue.registry.title")}
				>
					{registryBody()}
				</CatalogueSection>
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
	type ApplicationCategory,
	type ApplicationSetup,
	ApplicationsCatalogue,
	type ApplicationsCatalogueProps,
	type CatalogueApplication,
	CataloguePage,
	type CataloguePageProps,
}
