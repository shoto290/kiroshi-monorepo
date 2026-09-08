import type { ReactNode } from "react"

import { Icons } from "@workspace/ui/components/icons"

import { REPOSITORY_URL, WEBSITE_COPY } from "./copy"
import { PageGradient } from "./page-gradient"
import { ClaudeMark, DownloadMark, RabbitMark } from "./page-marks"

const ACTION_BASE =
	"inline-flex h-[46px] shrink-0 items-center gap-2 rounded-sm text-[15px] leading-5 font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"

const Fineprint = () => (
	<p className="flex flex-wrap items-center justify-center gap-1.5 pt-2.5 font-mono text-xs leading-4 tracking-[0.08em] text-muted-foreground md:gap-2 md:pt-0">
		<span>{WEBSITE_COPY.fineprintRuns}</span>
		<span className="flex items-center gap-1.5">
			<ClaudeMark />
			{WEBSITE_COPY.fineprintSubscription}
		</span>
		<span className="opacity-[0.55]">{WEBSITE_COPY.fineprintSeparator}</span>
		<span>{WEBSITE_COPY.fineprintLicense}</span>
	</p>
)

const DownloadAction = () => (
	<a
		className={`${ACTION_BASE} bg-foreground px-5 text-background hover:bg-foreground/90`}
		href={REPOSITORY_URL}
	>
		{WEBSITE_COPY.downloadAction}
		<DownloadMark />
	</a>
)

const GithubAction = () => (
	<a
		className={`${ACTION_BASE} border border-border bg-background px-[18px] text-foreground hover:bg-accent`}
		href={REPOSITORY_URL}
	>
		{WEBSITE_COPY.githubAction}
		<Icons.GitHub size={15} />
	</a>
)

type AppWindowProps = {
	mock: ReactNode
}

const AppWindow = ({ mock }: AppWindowProps) => (
	<div className="absolute top-[540px] left-1/2 hidden h-[700px] w-[1120px] max-w-[calc(100%-3rem)] -translate-x-1/2 md:block ultrawide:top-[700px] ultrawide:h-[720px] ultrawide:w-[1760px]">
		<RabbitMark className="top-[-193px] right-[39px] size-[208px] ultrawide:top-[-218px] ultrawide:right-[216px] ultrawide:size-[240px]" />
		<div className="relative grid size-full overflow-clip rounded-[16px] border border-border bg-sidebar shadow-[0_-2px_60px_-14px_#14141826]">
			{mock}
		</div>
	</div>
)

type WebsitePageProps = {
	mock?: ReactNode
}

export const WebsitePage = ({ mock }: WebsitePageProps) => (
	<main className="relative flex h-dvh w-full flex-col items-center overflow-clip bg-background">
		<PageGradient />
		<RabbitMark className="bottom-0 left-5 z-0 size-[330px] md:hidden" />
		<div className="relative z-10 flex w-full flex-col items-center gap-4 px-7 pt-33 text-center md:h-[540px] md:justify-center md:gap-[18px] md:pt-7 ultrawide:h-[640px] ultrawide:gap-5 ultrawide:pt-10">
			<h1 className="font-heading text-[28px] leading-[34px] font-medium tracking-[-0.028em] text-foreground md:text-[54px] md:leading-[60px] ultrawide:text-[64px] ultrawide:leading-[72px]">
				<span className="block">{WEBSITE_COPY.headlineFirstLine}</span>
				<span className="block">{WEBSITE_COPY.headlineSecondLine}</span>
			</h1>
			<p className="max-w-[310px] text-base leading-6 text-muted-foreground md:max-w-[740px] md:text-[19px] md:leading-7 ultrawide:max-w-[880px] ultrawide:text-[21px] ultrawide:leading-[30px]">
				{WEBSITE_COPY.lead}
			</p>
			<div className="flex flex-col items-center gap-3.5 pt-3.5 md:flex-row md:gap-3 md:pt-1">
				<p className="max-w-[302px] text-[15px] leading-[22px] text-foreground md:hidden">
					{WEBSITE_COPY.mobileNote}
				</p>
				<div className="hidden md:block">
					<DownloadAction />
				</div>
				<GithubAction />
			</div>
			<Fineprint />
		</div>
		<AppWindow mock={mock} />
	</main>
)
