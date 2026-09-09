"use client"

import {
	type ButtonHTMLAttributes,
	type CSSProperties,
	createContext,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import { useTranslation } from "react-i18next"

import { ContentCard } from "@workspace/ui/components/content-card"
import { EmptyStateShell } from "@workspace/ui/components/empty-state-shell"
import { Icons } from "@workspace/ui/components/icons"
import type { MissionState } from "@workspace/ui/components/mission"
import {
	MissionRow,
	type MissionRowModel,
} from "@workspace/ui/components/mission-row"
import { NestedSidebarProvider } from "@workspace/ui/components/nested-sidebar-provider"
import { Notice } from "@workspace/ui/components/notice"
import {
	ReportedRunRow,
	type ReportedRunRowModel,
} from "@workspace/ui/components/reported-run-row"
import {
	ROUTINE_DETAIL_EDIT_OPENER,
	RoutineDetail,
	type RoutineDetailModel,
} from "@workspace/ui/components/routine-detail"
import {
	RoutineForm,
	type RoutineFormModel,
	type RoutineFormValues,
	type RoutineTriggerSource,
} from "@workspace/ui/components/routine-form"
import {
	RoutineRow,
	type RoutineRowModel,
} from "@workspace/ui/components/routine-row"
import {
	SidebarResizeHandle,
	SidebarResizeProvider,
} from "@workspace/ui/components/sidebar-resize"
import { Button } from "@workspace/ui/components/ui/button"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
} from "@workspace/ui/components/ui/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const ROUTINES_PANEL_WIDTH = 320

const PANEL_SHELL =
	"surface-shell h-full min-h-0 min-w-0 flex-1 overflow-hidden"

const PANEL_SURFACE = "relative on-shell min-h-0 bg-transparent"

const PANEL_BODY = "gap-4 px-2 pt-1 pb-2"

const PANEL_HEADER =
	"h-13 shrink-0 flex-row items-center pt-[calc(--spacing(1)+1px)] pe-[calc(--spacing(3.5)+1px)] pb-0 ps-2"

type PanelWidthStyle = CSSProperties & { "--sidebar-width": string }

const panelWidthStyle = (width: number): PanelWidthStyle => ({
	"--sidebar-width": `${width}px`,
})

type RoutinesPanelHandle = {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	closeRef: RefObject<HTMLButtonElement | null>
	triggerRef: RefObject<HTMLButtonElement | null>
}

const RoutinesPanelContext = createContext<RoutinesPanelHandle | null>(null)

const useRoutinesPanel = () => {
	const handle = useContext(RoutinesPanelContext)
	if (!handle) {
		throw new Error("useRoutinesPanel must be used inside RoutinesPanel.")
	}
	return handle
}

const NEW_ROUTINE_KEY = "new-routine"
const NEW_ROUTINE_OPENER = "new-routine-opener"
const ROUTINES_OPENER = "routines-opener"

type RoutinesFailure = "missions" | "routines" | "activity" | "write"

type RoutinesPanelForm = {
	open: RoutineFormModel | null
	sources: RoutineTriggerSource[]
	canCreate: boolean
	onNew: () => void
	onOpen: (routineId: string) => void
	onClose: () => void
	onSave: (values: RoutineFormValues) => void
}

type RoutinesPanelDetail = {
	open: RoutineDetailModel | null
	onOpen: (routineId: string) => void
	onClose: () => void
	onRetryRuns: () => void
	onRunNow: () => void
}

type EarlierTodayRow =
	| ({ kind: "mission" } & MissionRowModel)
	| ({ kind: "run" } & ReportedRunRowModel)

type RoutinesPanelMissions = {
	open: MissionRowModel[]
	earlierToday: EarlierTodayRow[]
	onOpen: (missionId: string) => void
}

type RoutinesPanelListProps = {
	missions: RoutinesPanelMissions
	routines: RoutineRowModel[]
	failure: RoutinesFailure | null
	onRetry: () => void
	onEnabledChange: (id: string, isEnabled: boolean) => void
	onDelete: (id: string) => void | Promise<void>
	form?: RoutinesPanelForm
	detail?: RoutinesPanelDetail
}

type RoutinesPanelProps = RoutinesPanelListProps & {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	children: ReactNode
}

type MissionGroupKey = "waiting" | "inProgress"

type OpenMissionGroup = {
	key: MissionGroupKey
	states: MissionState[]
}

const OPEN_MISSION_GROUPS: OpenMissionGroup[] = [
	{ key: "waiting", states: ["waiting_human", "ready_to_merge"] },
	{ key: "inProgress", states: ["working", "waiting_bot", "failed"] },
]

const GROUP_HEAD_CLASS = "flex h-7 items-center gap-1.5 px-1.5"

const GROUP_FOLD_CLASS =
	"w-full rounded-lg text-start outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"

type ActivityGroupFold = {
	isOpen: boolean
	onToggle: () => void
}

type ActivityGroupProps = {
	slot: string
	title: string
	count: number
	fold?: ActivityGroupFold
	children: ReactNode
}

const ActivityGroup = ({
	slot,
	title,
	count: held,
	fold,
	children,
}: ActivityGroupProps) => {
	const titleId = useId()
	const listId = useId()
	const isUnfolded = fold ? fold.isOpen : true

	const count = (
		<span className="text-muted-foreground text-xs tabular-nums">{held}</span>
	)

	return (
		<section
			aria-labelledby={titleId}
			className="flex min-w-0 flex-col gap-0.5"
			data-slot={slot}
		>
			{fold ? (
				<h3 id={titleId}>
					<button
						aria-controls={listId}
						aria-expanded={isUnfolded}
						className={cn(GROUP_HEAD_CLASS, GROUP_FOLD_CLASS)}
						onClick={fold.onToggle}
						type="button"
					>
						<Icons.Expand
							aria-hidden="true"
							className={cn(
								"size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
								isUnfolded || "-rotate-90 rtl:rotate-90",
							)}
						/>
						<span className="font-medium text-foreground text-xs">{title}</span>
						{count}
					</button>
				</h3>
			) : (
				<div className={GROUP_HEAD_CLASS}>
					<h3 className="font-medium text-foreground text-xs" id={titleId}>
						{title}
					</h3>
					{count}
				</div>
			)}
			<ul className="flex flex-col gap-0.5" hidden={!isUnfolded} id={listId}>
				{children}
			</ul>
		</section>
	)
}

type RoutinesPanelBodyProps = RoutinesPanelListProps & {
	isShowingRoutines: boolean
	onOpenRoutine?: (routineId: string) => void
	onEditRoutine: () => void
}

const RoutinesPanelBody = ({
	missions,
	routines,
	failure,
	onRetry,
	onEnabledChange,
	onDelete,
	form,
	detail,
	isShowingRoutines,
	onOpenRoutine,
	onEditRoutine,
}: RoutinesPanelBodyProps) => {
	const { t } = useTranslation("chat")
	const [isEarlierTodayOpen, setEarlierTodayOpen] = useState(false)

	const notice = failure ? (
		<Notice
			description={t(`activity.failure.${failure}.description`)}
			retry={{ onRetry }}
			title={t(`activity.failure.${failure}.title`)}
		/>
	) : null

	if (form?.open) {
		return (
			<>
				{notice}
				<RoutineForm
					{...form.open}
					key={form.open.id ?? NEW_ROUTINE_KEY}
					onSave={form.onSave}
					sources={form.sources}
				/>
			</>
		)
	}

	if (detail?.open) {
		return (
			<>
				{notice}
				<RoutineDetail
					{...detail.open}
					key={detail.open.id}
					onEdit={onEditRoutine}
					onRetryRuns={detail.onRetryRuns}
					onRunNow={detail.onRunNow}
				/>
			</>
		)
	}

	if (isShowingRoutines) {
		return (
			<>
				{notice}
				{routines.length > 0 ? (
					<ul className="flex flex-col gap-2" data-slot="routines-list">
						{routines.map((routine) => (
							<RoutineRow
								{...routine}
								key={routine.id}
								onDelete={() => onDelete(routine.id)}
								onEnabledChange={(isEnabled) =>
									onEnabledChange(routine.id, isEnabled)
								}
								onOpen={
									onOpenRoutine ? () => onOpenRoutine(routine.id) : undefined
								}
							/>
						))}
					</ul>
				) : (
					<EmptyStateShell
						data-slot="routines-empty"
						description={t("routines.empty.description")}
						mark={
							<Icons.Routine
								aria-hidden="true"
								className="size-8 text-muted-foreground"
							/>
						}
						title={t("routines.empty.title")}
					/>
				)}
			</>
		)
	}

	if (missions.open.length === 0 && missions.earlierToday.length === 0) {
		return (
			notice ?? (
				<EmptyStateShell
					data-slot="activity-empty"
					description={t("activity.empty.description")}
					mark={
						<Icons.Bookmark
							aria-hidden="true"
							className="size-8 text-muted-foreground"
						/>
					}
					title={t("activity.empty.title")}
				/>
			)
		)
	}

	return (
		<>
			{notice}
			{OPEN_MISSION_GROUPS.map(({ key, states }) => {
				const held = missions.open.filter((mission) =>
					states.includes(mission.state),
				)
				if (held.length === 0) return null

				return (
					<ActivityGroup
						count={held.length}
						key={key}
						slot={`missions-${key}`}
						title={t(`activity.missions.group.${key}`)}
					>
						{held.map((mission) => (
							<MissionRow
								{...mission}
								key={mission.id}
								onOpen={() => missions.onOpen(mission.id)}
							/>
						))}
					</ActivityGroup>
				)
			})}
			{missions.earlierToday.length > 0 ? (
				<ActivityGroup
					count={missions.earlierToday.length}
					fold={{
						isOpen: isEarlierTodayOpen,
						onToggle: () => setEarlierTodayOpen((shown) => !shown),
					}}
					slot="missions-earlierToday"
					title={t("activity.missions.group.earlierToday")}
				>
					{missions.earlierToday.map((row) =>
						row.kind === "run" ? (
							<ReportedRunRow {...row} key={row.id} />
						) : (
							<MissionRow
								{...row}
								key={row.id}
								onOpen={() => missions.onOpen(row.id)}
							/>
						),
					)}
				</ActivityGroup>
			) : null}
		</>
	)
}

type PanelHeading = {
	back: "activity.routines.back" | "routines.detail.back" | "routines.form.back"
	onBack: () => void
	title:
		| "activity.routines.title"
		| "routines.detail.title"
		| "routines.form.edit"
		| "routines.form.new"
}

type HeadingSources = {
	form: RoutinesPanelForm | undefined
	detail: RoutinesPanelDetail | undefined
	isShowingRoutines: boolean
	onHideRoutines: () => void
}

const headingOf = ({
	form,
	detail,
	isShowingRoutines,
	onHideRoutines,
}: HeadingSources): PanelHeading | null => {
	if (form?.open) {
		return {
			back: detail?.open ? "routines.detail.back" : "routines.form.back",
			onBack: form.onClose,
			title: form.open.id ? "routines.form.edit" : "routines.form.new",
		}
	}

	if (detail?.open) {
		return {
			back: "routines.form.back",
			onBack: detail.onClose,
			title: "routines.detail.title",
		}
	}

	if (isShowingRoutines) {
		return {
			back: "activity.routines.back",
			onBack: onHideRoutines,
			title: "activity.routines.title",
		}
	}

	return null
}

const RoutinesPanelSurface = (props: RoutinesPanelListProps) => {
	const { t } = useTranslation("chat")
	const { closeRef, onOpenChange } = useRoutinesPanel()
	const [isShowingRoutines, setShowingRoutines] = useState(false)
	const surface = useRef<HTMLDivElement>(null)
	const openers = useRef<string[]>([])
	const { form, detail, routines } = props
	const heading = headingOf({
		form,
		detail,
		isShowingRoutines,
		onHideRoutines: () => setShowingRoutines(false),
	})
	const depth =
		(detail?.open ? 1 : 0) + (form?.open ? 1 : 0) + (isShowingRoutines ? 1 : 0)
	const shownDepth = useRef(depth)

	useEffect(() => {
		const hasPopped = depth < shownDepth.current
		shownDepth.current = depth
		const opener = hasPopped ? openers.current.pop() : undefined
		if (!opener) {
			return
		}

		surface.current
			?.querySelector<HTMLElement>(`[data-opens="${opener}"]`)
			?.focus({ preventScroll: true })
	}, [depth])

	const remember = (picked: string, act: () => void) => {
		openers.current.push(picked)
		act()
	}

	const editOpenRoutine = () => {
		const openId = detail?.open?.id
		if (openId) {
			remember(ROUTINE_DETAIL_EDIT_OPENER, () => form?.onOpen(openId))
		}
	}

	return (
		<Sidebar
			aria-label={t("activity.panel.label")}
			className={PANEL_SURFACE}
			collapsible="none"
			ref={surface}
			role="complementary"
		>
			<SidebarHeader className={PANEL_HEADER}>
				<div className="flex h-7 w-full items-center gap-2">
					{heading ? (
						<Button
							aria-label={t(heading.back)}
							onClick={heading.onBack}
							size="icon-sm"
							variant="ghost"
						>
							<Icons.Previous aria-hidden="true" />
						</Button>
					) : null}
					<h2 className="flex-1 font-medium text-sm">
						{t(heading?.title ?? "activity.panel.title")}
					</h2>
					{isShowingRoutines && form?.canCreate ? (
						<Button
							aria-label={t("routines.form.new")}
							data-opens={NEW_ROUTINE_OPENER}
							onClick={() => remember(NEW_ROUTINE_OPENER, form.onNew)}
							size="icon-sm"
							variant="ghost"
						>
							<Icons.Add aria-hidden="true" />
						</Button>
					) : null}
					<Button
						aria-label={t("activity.panel.close")}
						className="size-8"
						data-slot="routines-panel-close"
						onClick={() => onOpenChange(false)}
						ref={closeRef}
						size="icon-sm"
						variant="ghost"
					>
						<Icons.SidePanel aria-hidden="true" className="size-4" />
					</Button>
				</div>
			</SidebarHeader>
			<SidebarContent className={PANEL_BODY}>
				<RoutinesPanelBody
					{...props}
					isShowingRoutines={isShowingRoutines}
					onEditRoutine={editOpenRoutine}
					onOpenRoutine={
						detail &&
						((routineId) => remember(routineId, () => detail.onOpen(routineId)))
					}
				/>
			</SidebarContent>
			{heading ? null : (
				<SidebarFooter className="p-2">
					<button
						className="flex h-10 items-center gap-2.5 rounded-xl pe-3 ps-2.5 text-start outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"
						data-opens={ROUTINES_OPENER}
						data-slot="routines-entry"
						onClick={() =>
							remember(ROUTINES_OPENER, () => setShowingRoutines(true))
						}
						type="button"
					>
						<Icons.Routine
							aria-hidden="true"
							className="size-4 shrink-0 text-muted-foreground"
						/>
						<span className="flex-1 truncate text-[13px] text-foreground leading-5">
							{t("activity.routines.title")}
						</span>
						<span className="text-muted-foreground text-xs leading-5 tabular-nums">
							{routines.length}
						</span>
					</button>
				</SidebarFooter>
			)}
			<SidebarResizeHandle side="right" />
		</Sidebar>
	)
}

const RoutinesPanel = ({
	isOpen,
	onOpenChange,
	children,
	...list
}: RoutinesPanelProps) => {
	const closeRef = useRef<HTMLButtonElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const wasOpen = useRef(isOpen)
	const handle = useMemo<RoutinesPanelHandle>(
		() => ({ closeRef, isOpen, onOpenChange, triggerRef }),
		[isOpen, onOpenChange],
	)

	useEffect(() => {
		if (wasOpen.current === isOpen) return
		wasOpen.current = isOpen
		const landing = isOpen ? closeRef.current : triggerRef.current
		landing?.focus({ preventScroll: true })
	}, [isOpen])

	return (
		<RoutinesPanelContext.Provider value={handle}>
			<SidebarResizeProvider defaultWidth={ROUTINES_PANEL_WIDTH}>
				{(resize) => (
					<NestedSidebarProvider
						className={PANEL_SHELL}
						data-resizing={resize.isResizing}
						onOpenChange={onOpenChange}
						open={isOpen}
						style={panelWidthStyle(resize.width)}
					>
						<ContentCard isLandmark={false}>{children}</ContentCard>
						{isOpen ? <RoutinesPanelSurface {...list} /> : null}
					</NestedSidebarProvider>
				)}
			</SidebarResizeProvider>
		</RoutinesPanelContext.Provider>
	)
}

type RoutinesPanelTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>

const RoutinesPanelTrigger = (props: RoutinesPanelTriggerProps) => {
	const { t } = useTranslation("chat")
	const { isOpen, onOpenChange, triggerRef } = useRoutinesPanel()

	if (isOpen) return null

	return (
		<Button
			{...props}
			aria-expanded={isOpen}
			aria-label={t("activity.panel.toggle")}
			className="size-8"
			onClick={() => onOpenChange(true)}
			ref={triggerRef}
			size="icon-sm"
			variant="ghost"
		>
			<Icons.SidePanel aria-hidden="true" className="size-4" />
		</Button>
	)
}

export {
	type EarlierTodayRow,
	ROUTINES_PANEL_WIDTH,
	type RoutinesFailure,
	RoutinesPanel,
	type RoutinesPanelDetail,
	type RoutinesPanelForm,
	type RoutinesPanelMissions,
	type RoutinesPanelProps,
	RoutinesPanelTrigger,
	type RoutinesPanelTriggerProps,
}
