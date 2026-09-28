import type { ReactNode } from "react"

import { Icons } from "@workspace/ui/components/icons"
import { SkipLink } from "@workspace/ui/components/skip-link"

import { AUTHOR_URL, AUTHOR_X_URL, REPOSITORY_URL, WEBSITE_COPY } from "./copy"
import { DownloadMark } from "./page-marks"
import { type DownloadPlatform, useDownloadTarget } from "./use-download-target"

const HEXAGON_SRC = "/hexagon.svg"

const PAGE_COLUMN = "w-full max-w-[970px] shrink-0"

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

type AppWindowProps = {
	children?: ReactNode
}

const AppWindow = ({ children }: AppWindowProps) => (
	<div
		className={`${PAGE_COLUMN} scene-frozen relative hidden h-[700px] overflow-clip rounded-[16px] bg-sidebar shadow-frame lg:block dark:shadow-frame-dark`}
	>
		{children}
	</div>
)

const CREDIT_LINK = `${FOCUS_RING} -my-3 inline-flex rounded-sm py-3 transition-colors hover:text-foreground`

const Credit = () => (
	<footer className={`${PAGE_COLUMN} flex items-center gap-2.5 pt-40 pb-12`}>
		<img
			alt=""
			className="size-6 shrink-0 object-contain dark:invert"
			src={HEXAGON_SRC}
		/>
		<p className="flex flex-wrap items-center gap-1.5 font-mono text-xs leading-4 tracking-[0.08em] text-muted-foreground">
			<a
				aria-label={WEBSITE_COPY.creditDestination}
				className={CREDIT_LINK}
				href={AUTHOR_URL}
				rel="noreferrer noopener"
				target="_blank"
			>
				{WEBSITE_COPY.credit}
			</a>
			<span aria-hidden="true">{WEBSITE_COPY.creditSeparator}</span>
			<a
				className={CREDIT_LINK}
				href={AUTHOR_X_URL}
				rel="noreferrer noopener"
				target="_blank"
			>
				{WEBSITE_COPY.creditHandle}
			</a>
		</p>
	</footer>
)

type WebsitePageProps = {
	children?: ReactNode
}

export const WebsitePage = ({ children }: WebsitePageProps) => (
	<>
		<SkipLink label={WEBSITE_COPY.skipLink} targetId={MAIN_CONTENT_ID} />
		<main
			className="flex min-h-dvh w-full flex-col items-center overflow-x-clip bg-background px-7 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
			id={MAIN_CONTENT_ID}
			tabIndex={-1}
		>
			<div
				className={`${PAGE_COLUMN} flex flex-col items-start gap-[18px] pt-[88px] pb-16 wrap-break-word`}
			>
				<img
					alt=""
					className="h-[67px] w-[74px] shrink-0 dark:invert"
					src={HEXAGON_SRC}
				/>
				<h1 className="font-heading text-[28px] text-balance leading-[34px] font-medium tracking-[-0.028em] text-foreground lg:text-[54px] lg:leading-[60px]">
					{WEBSITE_COPY.headline}
				</h1>
				<p className="max-w-[600px] text-base leading-6 text-pretty text-muted-foreground lg:text-[19px] lg:leading-7">
					{WEBSITE_COPY.lead}
				</p>
				<div className="flex flex-col items-start gap-3.5 pt-1.5">
					<div className="flex flex-col items-start gap-2 lg:flex-row">
						<p className="max-w-[302px] text-[15px] leading-[22px] text-foreground lg:hidden">
							{WEBSITE_COPY.mobileNote}
						</p>
						<DownloadAction />
						<GithubAction label={WEBSITE_COPY.githubAction} />
					</div>
					<p className="font-mono text-xs leading-4 tracking-[0.08em] text-muted-foreground uppercase">
						{WEBSITE_COPY.fineprint}
					</p>
				</div>
			</div>
			<AppWindow>{children}</AppWindow>
			<section className={`${PAGE_COLUMN} pt-40`} id="three-ways" />
			<section className={`${PAGE_COLUMN} pt-32`} id="yours" />
			<section className={`${PAGE_COLUMN} pt-40`} id="faq" />
			<Credit />
		</main>
	</>
)
