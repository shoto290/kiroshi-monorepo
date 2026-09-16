"use client"

import { Tabs } from "@base-ui/react/tabs"
import { type ReactNode, useId, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import {
	MCP_ATTENTION_FIELD,
	MCP_CONNECTION_DOT,
	MCP_DESTRUCTIVE_SURFACE,
} from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import { type Icon, Icons } from "@workspace/ui/components/icons"
import {
	ApplicationMetaLine,
	ApplicationVerifiedPill,
} from "@workspace/ui/components/plugin-settings/application-identity"
import { ApplicationMark } from "@workspace/ui/components/plugin-settings/application-mark"
import {
	type ApplicationSetup,
	type CatalogueApplication,
	CataloguePage,
	type CataloguePageProps,
} from "@workspace/ui/components/plugin-settings/applications-catalogue"
import type { ApplicationsOwner } from "@workspace/ui/components/plugin-settings/applications-panel"
import { Button } from "@workspace/ui/components/ui/button"
import { useOverlayScrollbars } from "@workspace/ui/hooks/use-overlay-scrollbars"
import { cn } from "@workspace/ui/lib/utils"

type ApplicationPublication = {
	publisher: string
	publishedAt: string
}

type InstallableApplication = CatalogueApplication & {
	packageIdentity: string
	tools: string[]
	canWrite?: boolean
	keyPlace?: string
	keyPrefix?: string
	unreviewed?: ApplicationPublication
}

const ownerNameOf = (owner: ApplicationsOwner) =>
	owner.kind === "profile" ? "" : owner.name

type FactTone = "muted" | "attention" | "done"

const FACT_TONE = {
	muted: { glyph: "text-muted-foreground", sentence: "text-muted-foreground" },
	attention: { glyph: "text-bot-badge-attention", sentence: "text-foreground" },
	done: { glyph: "text-state-connected", sentence: "text-muted-foreground" },
} as const satisfies Record<FactTone, { glyph: string; sentence: string }>

type FactLineProps = {
	icon: Icon
	children: ReactNode
	tone?: FactTone
}

const FactLine = ({
	icon: LineIcon,
	children,
	tone = "muted",
}: FactLineProps) => (
	<p className="flex items-start gap-1.75" data-slot="application-fact">
		<LineIcon
			aria-hidden="true"
			className={cn("mt-0.5 size-3.75 shrink-0", FACT_TONE[tone].glyph)}
		/>
		<span
			className={cn(
				"min-w-0 wrap-break-word text-[13px]/4.5",
				FACT_TONE[tone].sentence,
			)}
		>
			{children}
		</span>
	</p>
)

type HostedFactsProps = {
	name: string
	host: string
	setup: ApplicationSetup
}

const HostedFacts = ({ name, host, setup }: HostedFactsProps) => {
	const { t } = useTranslation("bots")

	return (
		<>
			{setup === "signIn" ? (
				<FactLine icon={Icons.ExternalLink}>
					{t("applications.install.signIn.fact", { name })}
				</FactLine>
			) : null}
			<FactLine icon={Icons.Cloud} tone="attention">
				<Trans
					components={{ host: <span className="font-mono" /> }}
					i18nKey="applications.install.hosting"
					t={t}
					values={{ host }}
				/>
			</FactLine>
		</>
	)
}

type SignInNoticeProps = {
	name: string
}

const SignInNotice = ({ name }: SignInNoticeProps) => {
	const { t } = useTranslation("bots")

	return (
		<div
			className={cn(
				"flex items-start gap-3 rounded-xl border p-3",
				MCP_ATTENTION_FIELD,
			)}
		>
			<span className="mt-px flex size-4 shrink-0 items-center justify-center">
				<span
					aria-hidden="true"
					className={cn(
						"size-2 rounded-full",
						MCP_CONNECTION_DOT.needsAuthorization,
					)}
				/>
			</span>
			<div className="flex min-w-0 flex-col gap-0.75">
				<p className="wrap-break-word font-medium text-foreground text-sm/4.5">
					{t("applications.install.signIn.title", { name })}
				</p>
				<p className="wrap-break-word text-muted-foreground text-xs/[17px]">
					{t("applications.install.signIn.description")}
				</p>
			</div>
		</div>
	)
}

type KeyPanelProps = {
	application: InstallableApplication
	owner: ApplicationsOwner
	value: string
	onValueChange: (value: string) => void
}

const KeyPanel = ({
	application,
	owner,
	value,
	onValueChange,
}: KeyPanelProps) => {
	const { t } = useTranslation("bots")
	const [isRevealed, setRevealed] = useState(false)
	const titleId = useId()
	const inputId = useId()
	const descriptionId = useId()

	return (
		<div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3.5">
			<div className="flex flex-wrap items-baseline gap-x-3">
				<p
					className="wrap-break-word font-medium text-foreground text-sm/5"
					id={titleId}
				>
					{t("applications.install.key.title", { name: application.name })}
				</p>
				{application.keyPlace ? (
					<p className="ms-auto wrap-break-word text-muted-foreground text-xs/4">
						{application.keyPlace}
					</p>
				) : null}
			</div>
			<div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background ps-3 pe-1 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30">
				<input
					aria-describedby={descriptionId}
					aria-labelledby={titleId}
					autoComplete="off"
					className="min-w-0 flex-1 bg-transparent font-mono text-[13px]/5 text-foreground outline-none placeholder:text-muted-foreground"
					id={inputId}
					onChange={(event) => onValueChange(event.target.value)}
					placeholder={
						application.keyPrefix
							? t("applications.install.key.placeholder", {
									prefix: application.keyPrefix,
								})
							: undefined
					}
					spellCheck={false}
					type={isRevealed ? "text" : "password"}
					value={value}
				/>
				<Button
					aria-controls={inputId}
					aria-label={
						isRevealed
							? t("applications.install.key.concealLabel")
							: t("applications.install.key.revealLabel")
					}
					className="text-muted-foreground"
					onClick={() => setRevealed(!isRevealed)}
					size="xs"
					variant="ghost"
				>
					{isRevealed
						? t("applications.install.key.conceal")
						: t("applications.install.key.reveal")}
				</Button>
			</div>
			<p
				className="wrap-break-word text-muted-foreground text-xs/4"
				id={descriptionId}
			>
				{t(`applications.install.key.description.${owner.kind}`, {
					name: ownerNameOf(owner),
				})}
			</p>
		</div>
	)
}

type NothingToSetUpProps = {
	isHosted: boolean
}

const NothingToSetUp = ({ isHosted }: NothingToSetUpProps) => {
	const { t } = useTranslation("bots")

	return (
		<FactLine icon={Icons.Check} tone="done">
			{t(`applications.install.${isHosted ? "hostedNone" : "none"}`)}
		</FactLine>
	)
}

type UnreviewedNoticeProps = {
	publication: ApplicationPublication
	canWrite: boolean
	name: string
	hostedSource?: string
}

const UnreviewedNotice = ({
	publication,
	canWrite,
	name,
	hostedSource,
}: UnreviewedNoticeProps) => {
	const { t } = useTranslation("bots")
	const reach = canWrite ? "writes" : "reads"
	const publisher = publication.publisher
	const date = publication.publishedAt

	const sentence = () =>
		hostedSource === undefined
			? t(`applications.install.unreviewed.description.${reach}`, {
					publisher,
					date,
				})
			: t(`applications.install.unreviewed.hosted.${reach}`, {
					publisher,
					date,
					source: hostedSource,
					name,
				})

	return (
		<div
			className={cn(
				"flex items-start gap-2.5 rounded-xl border p-3.5",
				MCP_DESTRUCTIVE_SURFACE,
			)}
		>
			<Icons.Alert
				aria-hidden="true"
				className="mt-0.5 size-4 shrink-0 text-destructive"
			/>
			<div className="flex min-w-0 flex-col gap-0.75">
				<p className="wrap-break-word font-medium text-foreground text-sm/5">
					{t("applications.install.unreviewed.title")}
				</p>
				<p className="wrap-break-word text-[13px]/4.5 text-muted-foreground">
					{sentence()}
				</p>
			</div>
		</div>
	)
}

type ToolListProps = {
	tools: string[]
	canWrite?: boolean
}

const toolReachOf = (canWrite?: boolean) => {
	if (canWrite === undefined) return "plain"
	return canWrite ? "writes" : "reads"
}

const ToolList = ({ tools, canWrite }: ToolListProps) => {
	const { t } = useTranslation("bots")
	const headingId = useId()

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline gap-x-2">
				<h4 className="font-medium text-foreground text-sm/4.5" id={headingId}>
					{t("applications.install.tools.title")}
				</h4>
				<p className="text-muted-foreground text-xs/4 tabular-nums">
					{t(`applications.install.tools.count.${toolReachOf(canWrite)}`, {
						count: tools.length,
					})}
				</p>
			</div>
			<ul className="flex list-none flex-wrap gap-1.5 p-0">
				{tools.map((tool) => (
					<li
						className="min-h-6 min-w-0 max-w-full wrap-break-word rounded-full bg-muted px-2.5 py-1 font-mono text-foreground text-xs/4"
						key={tool}
					>
						{tool}
					</li>
				))}
			</ul>
		</section>
	)
}

type InstallActionProps = {
	setup: InstallableApplication["setup"]
	isHosted: boolean
	isInstalling: boolean
	isInstalled: boolean
	onInstall: () => void
}

const InstallAction = ({
	setup,
	isHosted,
	isInstalling,
	isInstalled,
	onInstall,
}: InstallActionProps) => {
	const { t } = useTranslation("bots")
	const isUnavailable = isInstalling || isInstalled
	const isSignIn = setup === "signIn" && !isHosted

	const readGlyph = () => {
		if (isInstalled) return Icons.Check
		if (isInstalling) return Icons.Loading
		return isSignIn ? Icons.ExternalLink : null
	}

	const Glyph = readGlyph()

	const readLabel = () => {
		if (isInstalled) return t("applications.install.done")
		return isSignIn
			? t("applications.install.signIn.action")
			: t("applications.add")
	}

	return (
		<Button
			aria-busy={isInstalling}
			aria-disabled={isUnavailable}
			className="rounded-full pr-3.5 has-data-[icon=inline-start]:pl-3 aria-disabled:pointer-events-none aria-disabled:opacity-50"
			onClick={() => {
				if (!isUnavailable) onInstall()
			}}
		>
			{Glyph ? (
				<Glyph
					aria-hidden="true"
					className={cn(
						"size-3.5",
						Glyph === Icons.Loading &&
							"animate-spin motion-reduce:animate-none",
					)}
					data-icon="inline-start"
				/>
			) : null}
			{readLabel()}
		</Button>
	)
}

type ApplicationInstallPageProps = Omit<CataloguePageProps, "children"> & {
	application: InstallableApplication
	owner: ApplicationsOwner
	isInstalling?: boolean
	isInstalled?: boolean
	failure?: string
	onInstall: (key?: string) => void
}

const ApplicationInstallPage = ({
	application,
	owner,
	isInstalling = false,
	isInstalled = false,
	failure,
	onInstall,
	...page
}: ApplicationInstallPageProps) => {
	const { t } = useTranslation("bots")
	const body = useRef<HTMLDivElement>(null)
	useOverlayScrollbars(body)
	const [key, setKey] = useState("")
	const isPackage = !application.description
	const { host } = application
	const hostedSource =
		host === undefined ? undefined : (application.source ?? host)

	const footnote = () =>
		hostedSource === undefined
			? t(`applications.install.footnote.${owner.kind}`, {
					name: ownerNameOf(owner),
				})
			: t(`applications.install.hostedFootnote.${owner.kind}`, {
					name: ownerNameOf(owner),
					source: hostedSource,
				})

	const setupBlock = () => {
		if (application.setup === "apiKey") {
			return (
				<KeyPanel
					application={application}
					onValueChange={setKey}
					owner={owner}
					value={key}
				/>
			)
		}

		if (application.setup === "none") {
			return <NothingToSetUp isHosted={host !== undefined} />
		}

		return host === undefined ? <SignInNotice name={application.name} /> : null
	}

	return (
		<CataloguePage {...page}>
			<div className="@container flex min-h-0 min-w-0 flex-1">
				<div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] @sm:grid-cols-[minmax(0,1fr)_auto] @sm:grid-rows-[auto_minmax(0,1fr)]">
					<div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 px-5 py-3 @sm:border-border @sm:border-b">
						<ApplicationMark mark={application.mark} />
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<div className="flex min-w-0 items-center gap-1.5">
								<h3
									className={cn(
										"truncate font-medium text-foreground text-sm/4.5",
										isPackage && "font-mono text-[15px]/4.5",
									)}
									title={application.name}
								>
									{application.name}
								</h3>
								{application.isVerified ? <ApplicationVerifiedPill /> : null}
							</div>
							<p
								className={cn(
									"wrap-break-word text-muted-foreground text-xs/4",
									isPackage && "font-mono",
								)}
							>
								{application.description ?? application.packageIdentity}
							</p>
							<ApplicationMetaLine
								source={application.source}
								useCount={application.useCount}
							/>
						</div>
					</div>

					<Tabs.Panel
						className="col-span-full row-start-3 flex min-h-0 flex-col gap-4.5 overflow-y-auto p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset @sm:row-start-2"
						ref={body}
						value={page.category}
					>
						{application.unreviewed ? (
							<UnreviewedNotice
								canWrite={application.canWrite ?? false}
								hostedSource={hostedSource}
								name={application.name}
								publication={application.unreviewed}
							/>
						) : null}
						<div className="flex flex-col gap-1.75">
							{setupBlock()}
							{host === undefined ? null : (
								<HostedFacts
									host={host}
									name={application.name}
									setup={application.setup}
								/>
							)}
						</div>
						{failure ? (
							<p
								className="wrap-break-word text-destructive text-xs/4"
								role="alert"
							>
								{failure}
							</p>
						) : null}
						<ToolList
							canWrite={application.canWrite}
							tools={application.tools}
						/>
						<div className="mt-auto flex items-start gap-2 border-border border-t pt-3">
							<Icons.Shield
								aria-hidden="true"
								className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
							/>
							<p className="min-w-0 wrap-break-word text-muted-foreground text-xs/[17px]">
								{footnote()}
							</p>
						</div>
					</Tabs.Panel>

					<div className="col-start-1 row-start-2 flex items-center border-border border-b px-5 pb-3 @sm:col-start-2 @sm:row-start-1 @sm:ps-0 @sm:pt-3">
						<InstallAction
							isHosted={host !== undefined}
							isInstalled={isInstalled}
							isInstalling={isInstalling}
							onInstall={() =>
								onInstall(application.setup === "apiKey" ? key : undefined)
							}
							setup={application.setup}
						/>
					</div>
				</div>
			</div>
		</CataloguePage>
	)
}

export {
	ApplicationInstallPage,
	type ApplicationInstallPageProps,
	type ApplicationPublication,
	type InstallableApplication,
}
