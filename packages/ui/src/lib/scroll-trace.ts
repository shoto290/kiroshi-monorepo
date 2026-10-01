type ScrollOrigin =
	| "content-mutation-observer"
	| "content-resize-observer"
	| "viewport-resize-observer"
	| "app-scroll-to-end"
	| "app-scroll-to-element"
	| "content-visibility-swap"
	| "window-rows"
	| "engine-handle-resize"
	| "unattributed"
	| "user-input"
	| "untagged-js-write"

type AppScrollWriter = "app-scroll-to-end" | "app-scroll-to-element"

type WriterOrigin =
	| AppScrollWriter
	| "content-mutation-observer"
	| "engine-handle-resize"
	| "untagged-js-write"

type WriteContext = {
	origin: WriterOrigin
	via?: string
}

type Write = WriteContext & {
	delta: number
}

type SmoothScroll = WriteContext & {
	until: number
}

type Change = {
	origin: ScrollOrigin
	via?: string
	dScrollTop: number
	dScrollHeight: number
	dReaderTop: number
}

type ScrollTraceEntry = Change & {
	t: number
	frame: number
	scrollTop: number
	scrollHeight: number
	clientHeight: number
	clientWidth: number
	thumbRatio: number
}

type AutoscrollingToggle = {
	t: number
	isOn: boolean
}

type OriginTally = {
	moves: number
	feltPx: number
	grossPx: number
	netPx: number
	scrollTopPx: number
	scrollHeightPx: number
}

type ScrollTraceSummary = {
	label: string
	messageId: string
	startedAt: number
	durationMs: number
	displacementPx: number | null
	frames: number
	autoscrollingToggles: number
	thumbRatioMin: number
	thumbRatioMax: number
	origins: Partial<Record<ScrollOrigin, OriginTally>>
}

type ScrollTrace = {
	mark: (label?: string) => ScrollTraceSummary | null
	sessions: () => ScrollTraceSummary[]
	entries: () => ScrollTraceEntry[]
	toggles: () => AutoscrollingToggle[]
	report: () => string
}

declare global {
	interface Window {
		kiroshiScrollTrace?: ScrollTrace
	}
}

type Layout = {
	scrollTop: number
	scrollHeight: number
	clientHeight: number
	clientWidth: number
	items: Element[]
	heights: Map<Element, number>
	reader: Element | undefined
	readerTop: number | null
}

type Session = {
	label: string
	element: Element
	messageId: string
	startedAt: number
	startTop: number
	endedAt?: number
	endTop?: number | null
	entriesFrom: number
	entriesTo?: number
}

type Natives = {
	MutationObserver: typeof MutationObserver
	ResizeObserver: typeof ResizeObserver
	requestAnimationFrame: typeof requestAnimationFrame
	cancelAnimationFrame: typeof cancelAnimationFrame
}

type Recorder = {
	natives: Natives
	frame: number
	entries: ScrollTraceEntry[]
	toggles: AutoscrollingToggle[]
	sessions: Session[]
	writes: Write[]
	smooth: SmoothScroll | null
	inputUntil: number
	pendingWheel: number
	isPointerDown: boolean
	isAwaitingStop: boolean
	cvEventFrames: WeakMap<Element, number>
}

const CONTENT_SLOT = "message-scroller-content"
const VIEWPORT_SLOT = "message-scroller-viewport"
const INPUT_QUIET_MS = 600
const SMOOTH_SCROLL_MS = 1000
const CHANGE_EPSILON = 0.01
const MOVE_EPSILON = 0.5
const SCROLL_HEIGHT_ROUNDING = 1
const CV_EVENT_FRAMES = 2

let recorder: Recorder | null = null
let activeContext: WriteContext | null = null

const now = () => performance.now()

const round = (value: number) => Math.round(value * 10) / 10

const runIn = <Result>(
	context: WriteContext | null,
	run: () => Result,
): Result => {
	if (!context) return run()
	const previous = activeContext
	activeContext = context
	try {
		return run()
	} finally {
		activeContext = previous
	}
}

export const traceScrollWrite = <Result>(
	origin: AppScrollWriter,
	write: () => Result,
): Result => (recorder ? runIn({ origin }, write) : write())

const isSlot = (target: Node, slot: string) =>
	target instanceof HTMLElement && target.dataset.slot === slot

const resizeViaOf = (target: Element) => {
	if (isSlot(target, CONTENT_SLOT)) return "content-resize-observer"
	if (isSlot(target, VIEWPORT_SLOT)) return "viewport-resize-observer"
}

const patchGlobals = (natives: Natives) => {
	const contexts = new WeakMap<object, WriteContext>()

	class TracedMutationObserver extends natives.MutationObserver {
		constructor(callback: MutationCallback) {
			super((records, observer) =>
				runIn(contexts.get(observer) ?? null, () =>
					callback(records, observer),
				),
			)
		}

		override observe(target: Node, options?: MutationObserverInit) {
			if (isSlot(target, CONTENT_SLOT)) {
				contexts.set(this, { origin: "content-mutation-observer" })
			}
			super.observe(target, options)
		}
	}

	class TracedResizeObserver extends natives.ResizeObserver {
		constructor(callback: ResizeObserverCallback) {
			super((entries, observer) =>
				runIn(contexts.get(observer) ?? null, () =>
					callback(entries, observer),
				),
			)
		}

		override observe(target: Element, options?: ResizeObserverOptions) {
			const via = resizeViaOf(target)
			if (via) contexts.set(this, { origin: "engine-handle-resize", via })
			super.observe(target, options)
		}
	}

	window.MutationObserver = TracedMutationObserver
	window.ResizeObserver = TracedResizeObserver
	window.requestAnimationFrame = (callback) => {
		const context = activeContext
		return natives.requestAnimationFrame.call(
			window,
			context ? (time) => runIn(context, () => callback(time)) : callback,
		)
	}

	return () => {
		window.MutationObserver = natives.MutationObserver
		window.ResizeObserver = natives.ResizeObserver
		window.requestAnimationFrame = natives.requestAnimationFrame
	}
}

const isSmoothScrollTo = (args: unknown[]) => {
	const [options] = args
	return (
		typeof options === "object" &&
		options !== null &&
		(options as ScrollToOptions).behavior === "smooth"
	)
}

type WriteHooksInput = {
	viewport: HTMLElement
	active: Recorder
}

const hookWrites = ({ viewport, active }: WriteHooksInput) => {
	const descriptor = Object.getOwnPropertyDescriptor(
		Element.prototype,
		"scrollTop",
	)
	const readTop = () => descriptor?.get?.call(viewport) as number
	const tracked = (write: () => void, isSmooth: boolean) => {
		const context = activeContext ?? { origin: "untagged-js-write" as const }
		const before = readTop()
		write()
		active.writes.push({ ...context, delta: readTop() - before })
		if (isSmooth) {
			active.smooth = { ...context, until: now() + SMOOTH_SCROLL_MS }
		}
	}

	Object.defineProperty(viewport, "scrollTop", {
		configurable: true,
		get: readTop,
		set: (value: number) =>
			tracked(() => descriptor?.set?.call(viewport, value), false),
	})
	Object.defineProperty(viewport, "scrollTo", {
		configurable: true,
		value: (...args: unknown[]) =>
			tracked(
				() => Reflect.apply(Element.prototype.scrollTo, viewport, args),
				isSmoothScrollTo(args),
			),
	})

	return {
		readTop,
		release: () => {
			Reflect.deleteProperty(viewport, "scrollTop")
			Reflect.deleteProperty(viewport, "scrollTo")
		},
	}
}

const placeholderHeightOf = (item: Element) => {
	const style = getComputedStyle(item)
	if (style.contentVisibility !== "auto") return null
	const size = Number.parseFloat(
		style.containIntrinsicHeight.replace("auto", "").trim(),
	)
	return Number.isFinite(size) ? size : null
}

const rowGapOf = (content: Element) => {
	const style = getComputedStyle(content)
	const gap = Number.parseFloat(style.rowGap)
	return Number.isFinite(gap) ? gap : 0
}

const gapOf = (item: Element, gap: number) =>
	item instanceof HTMLElement && item.hidden ? 0 : gap

const isInputActive = (active: Recorder) =>
	active.isPointerDown || now() < active.inputUntil

const emptyTally = (): OriginTally => ({
	moves: 0,
	feltPx: 0,
	grossPx: 0,
	netPx: 0,
	scrollTopPx: 0,
	scrollHeightPx: 0,
})

const feltShares = (frameEntries: ScrollTraceEntry[]) => {
	const moved = frameEntries.reduce((sum, entry) => sum + entry.dReaderTop, 0)
	const direction = Math.sign(moved)
	const pushing = frameEntries.map((entry) =>
		Math.max(0, entry.dReaderTop * direction),
	)
	const pushed = pushing.reduce((sum, share) => sum + share, 0)
	return pushing.map((share) =>
		pushed === 0 ? 0 : (Math.abs(moved) * share) / pushed,
	)
}

const tallyOrigins = (slice: ScrollTraceEntry[]) => {
	const origins: Partial<Record<ScrollOrigin, OriginTally>> = {}
	const byFrame = Map.groupBy(slice, (entry) => entry.frame)

	for (const frameEntries of byFrame.values()) {
		const felt = feltShares(frameEntries)
		frameEntries.forEach((entry, index) => {
			const tally = origins[entry.origin] ?? emptyTally()
			origins[entry.origin] = {
				moves:
					tally.moves + (Math.abs(entry.dReaderTop) >= MOVE_EPSILON ? 1 : 0),
				feltPx: round(tally.feltPx + felt[index]),
				grossPx: round(tally.grossPx + Math.abs(entry.dReaderTop)),
				netPx: round(tally.netPx + entry.dReaderTop),
				scrollTopPx: round(tally.scrollTopPx + Math.abs(entry.dScrollTop)),
				scrollHeightPx: round(
					tally.scrollHeightPx + Math.abs(entry.dScrollHeight),
				),
			}
		})
	}
	return origins
}

const TALLY_COLUMNS: (keyof OriginTally)[] = [
	"moves",
	"feltPx",
	"grossPx",
	"netPx",
	"scrollTopPx",
	"scrollHeightPx",
]

const summaryTable = (summary: ScrollTraceSummary) => {
	const rows = Object.entries(summary.origins)
		.sort(([, left], [, right]) => (right?.feltPx ?? 0) - (left?.feltPx ?? 0))
		.map(
			([origin, tally]) =>
				`| ${origin} | ${TALLY_COLUMNS.map((column) => tally?.[column]).join(" | ")} |`,
		)
	return [
		`### ${summary.label} (reader on ${summary.messageId})`,
		`displacement ${summary.displacementPx ?? "row lost"} px over ${Math.round(summary.durationMs)} ms, ${summary.frames} frames with a change, ${summary.autoscrollingToggles} data-autoscrolling toggles, thumb ratio ${summary.thumbRatioMin} to ${summary.thumbRatioMax}`,
		"",
		`| origin | ${TALLY_COLUMNS.join(" | ")} |`,
		`|---|${TALLY_COLUMNS.map(() => "---").join("|")}|`,
		...rows,
	].join("\n")
}

type ChangeDelta = Partial<Omit<Change, "origin" | "via">>

type ChangeSet = {
	add: (
		origin: ScrollOrigin,
		via: string | undefined,
		delta: ChangeDelta,
	) => void
	sum: (field: keyof ChangeDelta) => number
	list: () => Change[]
}

const isMeaningful = (change: Change) =>
	change.via === "client-size" ||
	Math.abs(change.dScrollTop) > CHANGE_EPSILON ||
	Math.abs(change.dScrollHeight) > CHANGE_EPSILON ||
	Math.abs(change.dReaderTop) > CHANGE_EPSILON

const changeSet = (): ChangeSet => {
	const changes = new Map<string, Change>()
	return {
		add: (origin, via, delta) => {
			const key = `${origin}|${via ?? ""}`
			const change = changes.get(key) ?? {
				origin,
				via,
				dScrollTop: 0,
				dScrollHeight: 0,
				dReaderTop: 0,
			}
			changes.set(key, {
				...change,
				dScrollTop: change.dScrollTop + (delta.dScrollTop ?? 0),
				dScrollHeight: change.dScrollHeight + (delta.dScrollHeight ?? 0),
				dReaderTop: change.dReaderTop + (delta.dReaderTop ?? 0),
			})
		},
		sum: (field) =>
			Array.from(changes.values()).reduce(
				(total, change) => total + change[field],
				0,
			),
		list: () => Array.from(changes.values()).filter(isMeaningful),
	}
}

type ViewportTraceInput = {
	viewport: HTMLElement
	active: Recorder
}

const traceViewport = ({ viewport, active }: ViewportTraceInput) => {
	const content = viewport.querySelector(`[data-slot="${CONTENT_SLOT}"]`)
	const gap = content ? rowGapOf(content) : 0
	const { readTop, release } = hookWrites({ viewport, active })
	let previous: Layout | null = null
	let frameRequest = 0

	const currentSession = () => {
		const session = active.sessions.at(-1)
		return session && session.endedAt === undefined ? session : undefined
	}

	const readerTopOf = (element: Element | undefined) =>
		element?.isConnected
			? element.getBoundingClientRect().top -
				viewport.getBoundingClientRect().top
			: null

	const readLayout = (reader: Element | undefined): Layout => {
		const items = content ? Array.from(content.children) : []
		return {
			scrollTop: readTop(),
			scrollHeight: viewport.scrollHeight,
			clientHeight: viewport.clientHeight,
			clientWidth: viewport.clientWidth,
			items,
			heights: new Map(
				items.map((item) => [item, item.getBoundingClientRect().height]),
			),
			reader,
			readerTop: readerTopOf(reader),
		}
	}

	const isSwap = (item: Element, previousHeight: number) => {
		const eventFrame = active.cvEventFrames.get(item)
		if (
			eventFrame !== undefined &&
			active.frame - eventFrame <= CV_EVENT_FRAMES
		)
			return true
		const placeholder = placeholderHeightOf(item)
		return (
			placeholder !== null &&
			Math.abs(previousHeight - placeholder) < MOVE_EPSILON
		)
	}

	const wheelShareOf = (unexplained: number) => {
		if (Math.sign(unexplained) !== Math.sign(active.pendingWheel)) return 0
		const share =
			Math.sign(unexplained) *
			Math.min(Math.abs(unexplained), Math.abs(active.pendingWheel))
		active.pendingWheel -= share
		return share
	}

	const residualScrollOrigin = (
		after: Layout,
		dScrollHeight: number,
	): { origin: ScrollOrigin; via?: string } => {
		if (active.isPointerDown) return { origin: "user-input", via: "pointer" }
		if (active.smooth && now() < active.smooth.until) {
			return { origin: active.smooth.origin, via: "smooth" }
		}
		const isClamped =
			dScrollHeight < 0 &&
			after.scrollTop >= after.scrollHeight - after.clientHeight - 1
		return { origin: "unattributed", via: isClamped ? "clamp" : undefined }
	}

	const itemOriginOf = (
		item: Element,
		previousHeight: number,
		isWidthChange: boolean,
	): ScrollOrigin => {
		if (isWidthChange) return "viewport-resize-observer"
		return isSwap(item, previousHeight)
			? "content-visibility-swap"
			: "content-resize-observer"
	}

	const addItemChanges = (
		changes: ChangeSet,
		before: Layout,
		after: Layout,
	) => {
		const reader = before.reader
		const readerBefore = reader ? before.items.indexOf(reader) : -1
		const readerAfter = reader ? after.items.indexOf(reader) : -1
		const isWidthChange = before.clientWidth !== after.clientWidth
		const firstKept = after.items.find((item) => before.heights.has(item))
		const firstKeptBefore = firstKept ? before.items.indexOf(firstKept) : -1
		const firstKeptAfter = firstKept ? after.items.indexOf(firstKept) : -1
		const edgeOrigin = (isTop: boolean): ScrollOrigin =>
			isTop ? "window-rows" : "content-mutation-observer"
		const placementOf = (item: Element, index: number) => {
			const previousHeight = before.heights.get(item)
			if (previousHeight !== undefined) {
				return {
					origin: itemOriginOf(item, previousHeight, isWidthChange),
					via: undefined,
					delta: (after.heights.get(item) ?? 0) - previousHeight,
				}
			}
			const isTop = index < firstKeptAfter
			return {
				origin: edgeOrigin(isTop),
				via: isTop ? "rows-loaded" : "rows-appended",
				delta: (after.heights.get(item) ?? 0) + gapOf(item, gap),
			}
		}

		after.items.forEach((item, index) => {
			const { origin, via, delta } = placementOf(item, index)
			if (Math.abs(delta) < CHANGE_EPSILON) return
			changes.add(origin, via, {
				dScrollHeight: delta,
				dReaderTop: index < readerAfter ? delta : 0,
			})
		})

		before.items.forEach((item, index) => {
			if (after.heights.has(item)) return
			const isTop = index < firstKeptBefore
			const delta = -((before.heights.get(item) ?? 0) + gapOf(item, gap))
			changes.add(edgeOrigin(isTop), isTop ? "rows-dropped" : "rows-removed", {
				dScrollHeight: delta,
				dReaderTop: index < readerBefore ? delta : 0,
			})
		})
	}

	const addScrollChanges = (
		changes: ChangeSet,
		before: Layout,
		after: Layout,
	) => {
		const dScrollHeight = after.scrollHeight - before.scrollHeight
		const heightResidual = dScrollHeight - changes.sum("dScrollHeight")
		if (Math.abs(heightResidual) > SCROLL_HEIGHT_ROUNDING) {
			changes.add("content-resize-observer", "outside-rows", {
				dScrollHeight: heightResidual,
			})
		}
		if (
			before.clientHeight !== after.clientHeight ||
			before.clientWidth !== after.clientWidth
		) {
			changes.add("viewport-resize-observer", "client-size", {})
		}
		for (const write of active.writes) {
			changes.add(write.origin, write.via, {
				dScrollTop: write.delta,
				dReaderTop: -write.delta,
			})
		}
		active.writes = []
		const unexplained =
			after.scrollTop - before.scrollTop - changes.sum("dScrollTop")
		const wheelShare = wheelShareOf(unexplained)
		if (Math.abs(wheelShare) > CHANGE_EPSILON) {
			changes.add("user-input", "wheel", {
				dScrollTop: wheelShare,
				dReaderTop: -wheelShare,
			})
		}
		const unexplainedTop = unexplained - wheelShare
		if (Math.abs(unexplainedTop) > CHANGE_EPSILON) {
			const residual = residualScrollOrigin(after, dScrollHeight)
			changes.add(residual.origin, residual.via, {
				dScrollTop: unexplainedTop,
				dReaderTop: -unexplainedTop,
			})
		}
	}

	const addReaderResidual = (
		changes: ChangeSet,
		before: Layout,
		after: Layout,
	) => {
		if (before.readerTop === null || after.readerTop === null) return
		const residual =
			after.readerTop - before.readerTop - changes.sum("dReaderTop")
		if (Math.abs(residual) > CHANGE_EPSILON) {
			changes.add("content-resize-observer", "outside-content", {
				dReaderTop: residual,
			})
		}
	}

	const diff = (before: Layout, after: Layout) => {
		const changes = changeSet()
		addItemChanges(changes, before, after)
		addScrollChanges(changes, before, after)
		addReaderResidual(changes, before, after)
		return changes.list()
	}

	const record = (after: Layout, changes: Change[]) => {
		const t = now()
		for (const change of changes) {
			active.entries.push({
				...change,
				dScrollTop: round(change.dScrollTop),
				dScrollHeight: round(change.dScrollHeight),
				dReaderTop: round(change.dReaderTop),
				t: round(t),
				frame: active.frame,
				scrollTop: round(after.scrollTop),
				scrollHeight: after.scrollHeight,
				clientHeight: after.clientHeight,
				clientWidth: after.clientWidth,
				thumbRatio:
					round((after.scrollHeight / after.clientHeight) * 100) / 100,
			})
		}
	}

	const firstRowInView = () => {
		const top = viewport.getBoundingClientRect().top
		const rows = Array.from(
			content?.querySelectorAll(":scope > [data-message-id]") ?? [],
		)
		return (
			rows.find(
				(row) => row.getBoundingClientRect().top >= top - MOVE_EPSILON,
			) ?? rows.at(-1)
		)
	}

	const closeSession = () => {
		const session = currentSession()
		if (!session) return
		session.endedAt = now()
		session.endTop = previous?.readerTop ?? readerTopOf(session.element)
		session.entriesTo = active.entries.length
	}

	const openSession = (label: string) => {
		closeSession()
		const element = firstRowInView()
		const startTop = readerTopOf(element)
		if (!element || startTop === null) return
		active.sessions.push({
			label,
			element,
			messageId: (element as HTMLElement).dataset.messageId ?? "",
			startedAt: now(),
			startTop,
			entriesFrom: active.entries.length,
		})
		previous = readLayout(element)
	}

	const followReader = (after: Layout): Layout => {
		const reader = currentSession()?.element ?? firstRowInView()
		return reader === after.reader
			? after
			: { ...after, reader, readerTop: readerTopOf(reader) }
	}

	const sample = () => {
		active.frame += 1
		const after = readLayout(previous?.reader)
		if (previous) record(after, diff(previous, after))
		previous = followReader(after)
		if (!isInputActive(active)) active.pendingWheel = 0
		if (active.isAwaitingStop && !isInputActive(active)) {
			active.isAwaitingStop = false
			openSession(`stop-${active.sessions.length + 1}`)
		}
		frameRequest = active.natives.requestAnimationFrame.call(window, sample)
	}

	const onInput = () => {
		active.inputUntil = now() + INPUT_QUIET_MS
		active.isAwaitingStop = true
		closeSession()
	}
	const onWheel = (event: WheelEvent) => {
		active.pendingWheel += event.deltaY
		onInput()
	}
	const onPointerDown = () => {
		active.isPointerDown = true
		onInput()
	}
	const onPointerUp = () => {
		if (!active.isPointerDown) return
		active.isPointerDown = false
		onInput()
	}
	const onVisibilityState = (event: Event) => {
		if (event.target instanceof Element) {
			active.cvEventFrames.set(event.target, active.frame)
		}
	}

	const toggleObserver = new active.natives.MutationObserver(() => {
		active.toggles.push({
			t: round(now()),
			isOn: viewport.hasAttribute("data-autoscrolling"),
		})
	})
	toggleObserver.observe(viewport, {
		attributeFilter: ["data-autoscrolling"],
		attributes: true,
	})

	viewport.addEventListener("wheel", onWheel, { passive: true })
	viewport.addEventListener("touchmove", onInput, { passive: true })
	viewport.addEventListener("keydown", onInput)
	viewport.addEventListener("pointerdown", onPointerDown)
	window.addEventListener("pointerup", onPointerUp)
	window.addEventListener("pointercancel", onPointerUp)
	content?.addEventListener(
		"contentvisibilityautostatechange",
		onVisibilityState,
		true,
	)
	frameRequest = active.natives.requestAnimationFrame.call(window, sample)

	return {
		mark: (label: string) => openSession(label),
		readerTopOf,
		detach: () => {
			active.natives.cancelAnimationFrame.call(window, frameRequest)
			toggleObserver.disconnect()
			viewport.removeEventListener("wheel", onWheel)
			viewport.removeEventListener("touchmove", onInput)
			viewport.removeEventListener("keydown", onInput)
			viewport.removeEventListener("pointerdown", onPointerDown)
			window.removeEventListener("pointerup", onPointerUp)
			window.removeEventListener("pointercancel", onPointerUp)
			content?.removeEventListener(
				"contentvisibilityautostatechange",
				onVisibilityState,
				true,
			)
			release()
		},
	}
}

let attached: ReturnType<typeof traceViewport> | null = null

const attachViewport = (viewport: HTMLElement | null) => {
	if (!recorder) return
	attached?.detach()
	attached = viewport ? traceViewport({ viewport, active: recorder }) : null
}

export const scrollTraceViewportRef = () =>
	recorder ? attachViewport : undefined

const summarize = (active: Recorder, session: Session): ScrollTraceSummary => {
	const slice = active.entries.slice(session.entriesFrom, session.entriesTo)
	const endedAt = session.endedAt ?? now()
	const endTop =
		session.endedAt === undefined
			? (attached?.readerTopOf(session.element) ?? null)
			: (session.endTop ?? null)
	const ratios = slice.map((entry) => entry.thumbRatio)
	return {
		label: session.label,
		messageId: session.messageId,
		startedAt: round(session.startedAt),
		durationMs: round(endedAt - session.startedAt),
		displacementPx: endTop === null ? null : round(endTop - session.startTop),
		frames: new Set(slice.map((entry) => entry.frame)).size,
		autoscrollingToggles: active.toggles.filter(
			(toggle) => toggle.t >= session.startedAt && toggle.t <= endedAt,
		).length,
		thumbRatioMin: ratios.length > 0 ? Math.min(...ratios) : 0,
		thumbRatioMax: ratios.length > 0 ? Math.max(...ratios) : 0,
		origins: tallyOrigins(slice),
	}
}

const traceApi = (active: Recorder): ScrollTrace => {
	const sessions = () =>
		active.sessions.map((session) => summarize(active, session))
	return {
		mark: (label = `mark-${active.sessions.length + 1}`) => {
			attached?.mark(label)
			const session = active.sessions.at(-1)
			return session ? summarize(active, session) : null
		},
		sessions,
		entries: () => active.entries,
		toggles: () => active.toggles,
		report: () =>
			[`${navigator.userAgent}`, ...sessions().map(summaryTable)].join("\n\n"),
	}
}

export const installScrollTrace = () => {
	if (recorder) return () => {}
	const natives: Natives = {
		MutationObserver: window.MutationObserver,
		ResizeObserver: window.ResizeObserver,
		requestAnimationFrame: window.requestAnimationFrame,
		cancelAnimationFrame: window.cancelAnimationFrame,
	}
	const restoreGlobals = patchGlobals(natives)
	const active: Recorder = {
		natives,
		frame: 0,
		entries: [],
		toggles: [],
		sessions: [],
		writes: [],
		smooth: null,
		inputUntil: 0,
		pendingWheel: 0,
		isPointerDown: false,
		isAwaitingStop: false,
		cvEventFrames: new WeakMap(),
	}
	recorder = active
	window.kiroshiScrollTrace = traceApi(active)

	return () => {
		attached?.detach()
		attached = null
		restoreGlobals()
		recorder = null
		window.kiroshiScrollTrace = undefined
	}
}
