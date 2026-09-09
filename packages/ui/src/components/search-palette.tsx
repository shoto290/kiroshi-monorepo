"use client"

import { Dialog } from "@base-ui/react/dialog"
import { type ReactNode, useId, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { EmptyStateShell } from "@workspace/ui/components/empty-state-shell"
import { Icons } from "@workspace/ui/components/icons"
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/motion/tabs"
import {
	SearchResultRow,
	type SearchResultRowProps,
} from "@workspace/ui/components/search-result-row"
import {
	BACKDROP_CLASS,
	DIALOG_POPUP_CLASS,
} from "@workspace/ui/components/settings-styles"
import { Switch } from "@workspace/ui/components/switch"
import { Kbd, KbdGroup } from "@workspace/ui/components/ui/kbd"
import { cn } from "@workspace/ui/lib/utils"

type SearchKind = "messages" | "chats" | "missions" | "routines"

type SearchTab = "all" | SearchKind

type SearchRestingKind = Exclude<SearchKind, "messages">

type SearchPaletteResult = Omit<
	SearchResultRowProps,
	"id" | "isActive" | "rank" | "rankLabel"
> & { id: string }

type SearchResultGroup = {
	kind: SearchKind
	total: number
	results: SearchPaletteResult[]
}

type SearchRestingGroup = {
	kind: SearchRestingKind
	results: SearchPaletteResult[]
}

type SearchPaletteProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	query: string
	onQueryChange: (query: string) => void
	tab: SearchTab
	onTabChange: (tab: SearchTab) => void
	isScopeAllSpaces: boolean
	onScopeChange: (isAllSpaces: boolean) => void
	spaceName: string
	results: SearchResultGroup[]
	resting: SearchRestingGroup[]
	isLoading?: boolean
	activeResultId?: string
}

type SectionHead = {
	label: string
	total?: number
	seeAllKind?: SearchKind
}

type PaletteSection = {
	key: string
	head?: SectionHead
	results: SearchPaletteResult[]
}

const TABS: SearchTab[] = ["all", "messages", "chats", "missions", "routines"]

const RESTING_KINDS: SearchRestingKind[] = ["chats", "missions", "routines"]

const PANEL_MARK_CLASS = "size-8 text-muted-foreground"

const RESTING_MARKS: Record<SearchRestingKind, ReactNode> = {
	chats: <Icons.Message aria-hidden="true" className={PANEL_MARK_CLASS} />,
	missions: <Icons.Bookmark aria-hidden="true" className={PANEL_MARK_CLASS} />,
	routines: <Icons.Routine aria-hidden="true" className={PANEL_MARK_CLASS} />,
}

const SHOWN_PER_KIND = 3

const FIRST_RANK = 1

const POPUP_CLASS =
	"-translate-x-1/2 fixed top-27 left-1/2 z-50 flex h-146 max-h-[calc(100vh-9rem)] w-160 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl"

const QUERY_LINE_CLASS =
	"flex h-13 shrink-0 items-center gap-2.5 border-border border-b px-4"

const INPUT_CLASS =
	"min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"

const TAB_ROW_CLASS =
	"flex h-11 shrink-0 items-center justify-between gap-2 px-3"

const TAB_TRIGGER_CLASS = "h-7.5 py-0"

const BODY_CLASS =
	"flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset"

const PANEL_CLASS = "my-auto"

const LIST_CLASS = "flex flex-col gap-0.5"

const SECTION_HEAD_CLASS = "flex h-7 items-center gap-1.5 px-2"

const SEE_ALL_CLASS =
	"ms-auto rounded-md text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"

const FOOTER_CLASS =
	"flex h-9 shrink-0 items-center gap-4 border-border border-t bg-muted px-4"

const HINT_CLASS = "flex items-center gap-1.5 text-[11px] text-muted-foreground"

const KEYCAP_CLASS = "bg-background"

const SearchPaletteFooter = () => {
	const { t } = useTranslation("search")

	const hints = [
		{
			key: "move",
			cap: (
				<KbdGroup>
					<Kbd className={KEYCAP_CLASS}>
						<Icons.ArrowUp aria-hidden="true" />
					</Kbd>
					<Kbd className={KEYCAP_CLASS}>
						<Icons.ArrowDown aria-hidden="true" />
					</Kbd>
				</KbdGroup>
			),
			label: t("hint.move"),
		},
		{
			key: "open",
			cap: <Kbd className={KEYCAP_CLASS}>↵</Kbd>,
			label: t("hint.open"),
		},
		{
			key: "rank",
			cap: <Kbd className={KEYCAP_CLASS}>⌘1-9</Kbd>,
			label: t("hint.rank"),
		},
		{
			key: "tab",
			cap: <Kbd className={KEYCAP_CLASS}>⇥</Kbd>,
			label: t("hint.tab"),
		},
	]

	return (
		<div className={FOOTER_CLASS} data-slot="search-palette-footer">
			{hints.map((hint) => (
				<span className={HINT_CLASS} key={hint.key}>
					{hint.cap}
					{hint.label}
				</span>
			))}
		</div>
	)
}

const SearchPalette = ({
	open,
	onOpenChange,
	query,
	onQueryChange,
	tab,
	onTabChange,
	isScopeAllSpaces,
	onScopeChange,
	spaceName,
	results,
	resting,
	isLoading = false,
	activeResultId,
}: SearchPaletteProps) => {
	const { t } = useTranslation("search")
	const input = useRef<HTMLInputElement>(null)
	const listId = useId()
	const scopeId = useId()
	const label = t("open")
	const isRest = query === ""
	const isAllTab = tab === "all"

	const restingOf = (kind: SearchRestingKind) =>
		resting.find((group) => group.kind === kind)?.results ?? []

	const restingSections: PaletteSection[] = RESTING_KINDS.map((kind) => ({
		kind,
		rows: restingOf(kind),
	}))
		.filter(({ kind, rows }) => (isAllTab || tab === kind) && rows.length > 0)
		.map(({ kind, rows }) => ({
			key: kind,
			head: {
				label: t(`rest.${kind}`),
				seeAllKind: isAllTab && rows.length > SHOWN_PER_KIND ? kind : undefined,
			},
			results: isAllTab ? rows.slice(0, SHOWN_PER_KIND) : rows,
		}))

	const foundSections: PaletteSection[] = results
		.filter(
			(group) => group.results.length > 0 && (isAllTab || group.kind === tab),
		)
		.map((group) =>
			isAllTab
				? {
						key: group.kind,
						head: {
							label: t(`tab.${group.kind}`),
							total: group.total,
							seeAllKind: group.total > SHOWN_PER_KIND ? group.kind : undefined,
						},
						results: group.results.slice(0, SHOWN_PER_KIND),
					}
				: { key: group.kind, results: group.results },
		)

	const sections = isRest ? restingSections : foundSections

	const shown = sections.flatMap((section) => section.results)
	const rankOf = new Map(
		shown.map((result, index) => [result.id, index + FIRST_RANK]),
	)
	const rowId = (id: string) => `${listId}-${id}`
	const sectionListId = (key: string) => `${listId}-${key}`
	const activeId =
		activeResultId && rankOf.has(activeResultId)
			? rowId(activeResultId)
			: undefined

	const ownedLists =
		shown.length === 0
			? listId
			: sections.map((section) => sectionListId(section.key)).join(" ")

	const scopeAction = (action: string) =>
		isScopeAllSpaces ? undefined : (
			<Button
				className="rounded-lg"
				onClick={() => onScopeChange(true)}
				size="sm"
				variant="secondary"
			>
				{action}
			</Button>
		)

	const searchMark = (
		<Icons.Search aria-hidden="true" className={PANEL_MARK_CLASS} />
	)

	const instructionPanel = (action?: ReactNode) => (
		<EmptyStateShell
			action={action}
			className={PANEL_CLASS}
			data-slot="search-palette-rest"
			description={t("rest.messages.body", { space: spaceName })}
			mark={searchMark}
			title={t("rest.messages.title")}
		/>
	)

	const restingPanel = (kind: SearchRestingKind) => (
		<EmptyStateShell
			action={scopeAction(t("rest.action"))}
			className={PANEL_CLASS}
			data-slot="search-palette-rest"
			description={t(`rest.none.body.${kind}`, { space: spaceName })}
			mark={RESTING_MARKS[kind]}
			title={t(`rest.none.${kind}`)}
		/>
	)

	const foundPanel = (
		<EmptyStateShell
			action={scopeAction(t("empty.action"))}
			className={PANEL_CLASS}
			data-slot="search-palette-empty"
			description={t("empty.description", { space: spaceName, query })}
			mark={searchMark}
			title={t("empty.title")}
		/>
	)

	const panelOf = () => {
		if (shown.length > 0) return null
		if (!isRest) return isLoading ? null : foundPanel
		if (tab === "messages") return instructionPanel()
		if (isLoading) return null
		if (!isAllTab) return restingPanel(tab)
		return instructionPanel(scopeAction(t("rest.action")))
	}

	const rowOf = ({ id, space, ...rest }: SearchPaletteResult) => (
		<SearchResultRow
			{...rest}
			id={rowId(id)}
			isActive={id === activeResultId}
			key={id}
			rank={rankOf.get(id)}
			space={isScopeAllSpaces ? space : undefined}
		/>
	)

	return (
		<Dialog.Root onOpenChange={onOpenChange} open={open}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={BACKDROP_CLASS}
					data-slot="search-palette-backdrop"
				/>
				<Dialog.Popup
					aria-label={label}
					className={cn(DIALOG_POPUP_CLASS, POPUP_CLASS)}
					data-slot="search-palette"
					initialFocus={input}
				>
					<div className={QUERY_LINE_CLASS} data-slot="search-palette-query">
						<Icons.Search
							aria-hidden="true"
							className="size-[18px] shrink-0 text-muted-foreground"
						/>
						<input
							aria-activedescendant={activeId}
							aria-controls={ownedLists}
							aria-expanded
							aria-label={label}
							autoComplete="off"
							className={INPUT_CLASS}
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder={t("placeholder")}
							ref={input}
							role="combobox"
							value={query}
						/>
						<Kbd>{t("close")}</Kbd>
					</div>

					<div className={TAB_ROW_CLASS} data-slot="search-palette-tabs">
						<Tabs
							onValueChange={(value) => onTabChange(value as SearchTab)}
							value={tab}
							variant="pill"
						>
							<TabsList className="bg-transparent p-0">
								{TABS.map((candidate) => (
									<TabsTrigger
										className={TAB_TRIGGER_CLASS}
										key={candidate}
										value={candidate}
									>
										{t(`tab.${candidate}`)}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
						<div className="flex shrink-0 items-center gap-2">
							<span className="text-muted-foreground text-xs" id={scopeId}>
								{t("scope")}
							</span>
							<Switch
								aria-labelledby={scopeId}
								checked={isScopeAllSpaces}
								onCheckedChange={onScopeChange}
							/>
						</div>
					</div>

					<div
						aria-busy={isLoading}
						className={BODY_CLASS}
						data-slot="search-palette-body"
						// biome-ignore lint/a11y/noNoninteractiveTabindex: the body scrolls on its own and every row inside it is driven by aria-activedescendant, so this is the only handle a keyboard has on it
						tabIndex={0}
					>
						{sections.map(({ key, head, results: rows }) => {
							const seeAllKind = head?.seeAllKind
							const list = (
								<div
									aria-label={head?.label ?? t("results")}
									className={LIST_CLASS}
									id={sectionListId(key)}
									key={key}
									role="listbox"
								>
									{rows.map(rowOf)}
								</div>
							)

							if (!head) return list

							return (
								<div className={LIST_CLASS} key={key}>
									<div
										className={SECTION_HEAD_CLASS}
										data-slot="search-palette-section-head"
									>
										<span className="font-medium text-foreground text-xs">
											{head.label}
										</span>
										{head.total === undefined ? null : (
											<span className="text-muted-foreground text-xs tabular-nums">
												{head.total}
											</span>
										)}
										{seeAllKind ? (
											<button
												className={SEE_ALL_CLASS}
												data-slot="search-palette-see-all"
												onClick={() => onTabChange(seeAllKind)}
												type="button"
											>
												{t("seeAll")}
											</button>
										) : null}
									</div>
									{list}
								</div>
							)
						})}

						{shown.length > 0 ? null : (
							<div
								aria-label={t("results")}
								className={LIST_CLASS}
								id={listId}
								role="listbox"
							/>
						)}

						{panelOf()}
					</div>

					<SearchPaletteFooter />
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

export {
	type SearchKind,
	SearchPalette,
	type SearchPaletteProps,
	type SearchPaletteResult,
	type SearchRestingGroup,
	type SearchRestingKind,
	type SearchResultGroup,
	type SearchTab,
}
