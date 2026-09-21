import type { ReactNode } from "react"

import { AppIconMark } from "@workspace/ui/components/app-icon-mark"
import { Icons } from "@workspace/ui/components/icons"
import { SkipLink } from "@workspace/ui/components/skip-link"

import { AUTHOR_URL, AUTHOR_X_URL, REPOSITORY_URL, WEBSITE_COPY } from "./copy"
import { DownloadMark } from "./page-marks"
import { PageWash } from "./page-wash"
import { type DownloadPlatform, useDownloadTarget } from "./use-download-target"

const VIEWPORT_RISE = "[--rise:clamp(0px,100vw_-_1440px,1120px)]"

const MAIN_CONTENT_ID = "main-content"

const FOCUS_RING =
	"outline-none focus-visible:shadow-focus-edge focus-visible:ring-3 focus-visible:ring-ring/30"

const ACTION_BASE = `${FOCUS_RING} h-[46px] shrink-0 items-center gap-2 rounded-sm text-[15px] leading-5 font-medium whitespace-nowrap transition-[color,background-color,transform] duration-200 ease-out hover:will-change-transform active:will-change-transform active:transform-[scale(0.97)]`

const DOWNLOAD_LABEL: Record<DownloadPlatform, string> = {
	macos: WEBSITE_COPY.downloadActionMacOS,
	windows: WEBSITE_COPY.downloadActionWindows,
	linux: WEBSITE_COPY.downloadActionLinux,
	other: WEBSITE_COPY.downloadAction,
}

type ActionProps = {
	label: string
}

const DownloadAction = () => {
	const { href, onActivate, platform } = useDownloadTarget()

	return (
		<a
			className={`${ACTION_BASE} hidden bg-foreground ps-5 pe-4 text-background hover:bg-foreground/90 lg:inline-flex`}
			href={href}
			onClick={onActivate}
		>
			{DOWNLOAD_LABEL[platform]}
			<DownloadMark />
		</a>
	)
}

const GithubAction = ({ label }: ActionProps) => (
	<a
		className={`${ACTION_BASE} inline-flex bg-background ps-4.5 shadow-edge pe-3.5 text-foreground hover:bg-accent`}
		href={REPOSITORY_URL}
	>
		{label}
		<Icons.GitHub size={15} />
	</a>
)

type FineprintProps = {
	runs: string
	subscription: string
	separator: string
	license: string
}

const Fineprint = ({
	license,
	runs,
	separator,
	subscription,
}: FineprintProps) => (
	<p className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs leading-4 tracking-[0.08em] text-muted-foreground uppercase lg:mt-0 lg:gap-2">
		<span>{runs}</span>
		<span className="flex items-center gap-1.5">
			<Icons.Claude className="shrink-0 text-claude" size={13} />
			{subscription}
		</span>
		<span aria-hidden="true" className="opacity-[0.55]">
			{separator}
		</span>
		<span>{license}</span>
	</p>
)

type AppWindowProps = {
	children?: ReactNode
}

const AppWindow = ({ children }: AppWindowProps) => (
	<div className="relative hidden w-full shrink-0 justify-center lg:flex">
		<div className="relative mt-[calc(var(--rise)*60/1120)] h-[700px] w-[calc(100%_-_320px)] max-w-[1760px] ultrawide:h-[720px]">
			<div className="scene-frozen relative size-full overflow-clip rounded-[16px] bg-sidebar shadow-frame dark:shadow-frame-dark">
				{children}
			</div>
		</div>
	</div>
)

const CREDIT_LINK = `${FOCUS_RING} inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 transition-colors min-h-10 hover:text-foreground`

type CreditProps = {
	label: string
	destination: string
	handle: string
	separator: string
}

const Credit = ({ destination, handle, label, separator }: CreditProps) => (
	<footer className="on-wash relative z-10 mt-auto flex w-full shrink-0 justify-center px-7 pt-12 pb-8 lg:pt-16 lg:pb-10">
		<p className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs leading-4 tracking-[0.08em] text-muted-foreground lg:gap-2">
			<a
				aria-label={destination}
				className={CREDIT_LINK}
				href={AUTHOR_URL}
				rel="noreferrer noopener"
				target="_blank"
			>
				<Icons.GitHub className="shrink-0" size={13} />
				{label}
			</a>
			<span aria-hidden="true" className="opacity-[0.55]">
				{separator}
			</span>
			<a
				className={CREDIT_LINK}
				href={AUTHOR_X_URL}
				rel="noreferrer noopener"
				target="_blank"
			>
				<Icons.X className="shrink-0" size={11} />
				{handle}
			</a>
		</p>
	</footer>
)

type WebsitePageProps = {
	children?: ReactNode
}

export const WebsitePage = ({ children }: WebsitePageProps) => (
	<>
		<SkipLink targetId={MAIN_CONTENT_ID} />
		<main
			className={`${VIEWPORT_RISE} relative flex min-h-dvh w-full flex-col items-center overflow-x-clip bg-background outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring`}
			id={MAIN_CONTENT_ID}
			tabIndex={-1}
		>
			<PageWash />
			<div className="on-wash relative z-10 flex w-full shrink-0 flex-col items-center gap-4 px-7 pt-33 text-center wrap-break-word lg:min-h-[60dvh] lg:justify-center lg:gap-[18px] lg:pt-7 ultrawide:gap-5 ultrawide:pt-10">
				<AppIconMark className="lg:size-18 ultrawide:size-20" size={64} />
				<h1 className="font-heading text-[28px] text-balance leading-[34px] font-medium tracking-[-0.028em] text-foreground lg:text-[54px] lg:leading-[60px] ultrawide:text-[64px] ultrawide:leading-[72px]">
					{WEBSITE_COPY.headline}
				</h1>
				<p className="max-w-prose text-base leading-6 text-pretty text-muted-foreground lg:text-[19px] lg:leading-7 ultrawide:text-[21px] ultrawide:leading-[30px]">
					{WEBSITE_COPY.lead}
				</p>
				<div className="flex flex-col items-center gap-2 lg:flex-row">
					<p className="max-w-[302px] text-[15px] leading-[22px] text-foreground lg:hidden">
						{WEBSITE_COPY.mobileNote}
					</p>
					<DownloadAction />
					<GithubAction label={WEBSITE_COPY.githubAction} />
				</div>
				<Fineprint
					license={WEBSITE_COPY.fineprintLicense}
					runs={WEBSITE_COPY.fineprintRuns}
					separator={WEBSITE_COPY.fineprintSeparator}
					subscription={WEBSITE_COPY.fineprintSubscription}
				/>
			</div>
			<AppWindow>{children}</AppWindow>
			<Credit
				destination={WEBSITE_COPY.creditDestination}
				handle={WEBSITE_COPY.creditHandle}
				label={WEBSITE_COPY.credit}
				separator={WEBSITE_COPY.fineprintSeparator}
			/>
		</main>
	</>
)
