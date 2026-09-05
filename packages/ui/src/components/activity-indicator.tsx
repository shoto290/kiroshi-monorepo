"use client"

import type { TFunction } from "i18next"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { BotAvatarBlot } from "@workspace/ui/components/bot-avatar"
import type { BotAvatarAnimal } from "@workspace/ui/components/bot-avatar-animals"
import {
	type ActivityIndicatorKind,
	BotIdentityAvatar,
	BotStopButton,
	type BotStopProps,
} from "@workspace/ui/components/bot-identity-avatar"
import { useMarkId } from "@workspace/ui/components/mark-context"
import { SharedMark } from "@workspace/ui/components/motion/shared-mark"
import {
	TextShimmer,
	WORKING_SHIMMER_DURATION,
} from "@workspace/ui/components/motion/text-shimmer"
import { Tooltip } from "@workspace/ui/components/motion/tooltip"
import { TURN_AVATAR_SIZE } from "@workspace/ui/components/turn"
import { cn } from "@workspace/ui/lib/utils"

type ActivityIndicatorWait = "you" | "next"

type ActivityIndicatorProps = BotStopProps & {
	kind?: ActivityIndicatorKind
	botId?: string
	name?: string
	label?: string
	waitingOn?: ActivityIndicatorWait
	startedAt?: number
	animal?: BotAvatarAnimal
	blot?: BotAvatarBlot
	image?: string
	seed?: string
	size?: number
	className?: string
}

const MCP_PREFIX = "mcp__"

const SECOND = 1000

const readableTool = (t: TFunction<"chat">, token: string) => {
	if (!token.startsWith(MCP_PREFIX)) return token
	const [server, ...tool] = token.slice(MCP_PREFIX.length).split("__")
	if (tool.length === 0) return token
	return t("working.mcp", { server, tool: tool.join("__") })
}

const readableLabel = (t: TFunction<"chat">, label: string) =>
	label
		.split(" ")
		.map((token) => readableTool(t, token))
		.join(" ")

type RowTextInput = {
	t: TFunction<"chat">
	kind: ActivityIndicatorKind
	name: string
	label?: string
	waitingOn: ActivityIndicatorWait
}

const rowTextOf = ({ t, kind, name, label, waitingOn }: RowTextInput) => {
	if (kind === "waiting") {
		if (waitingOn === "next") return t("working.upNext", { name })
		return label
			? t("working.waitingTitled", { name, title: label })
			: t("working.state", { name, verb: t("working.verb.waiting") })
	}
	return label
		? t("working.labelled", { name, label: readableLabel(t, label) })
		: t("working.state", { name, verb: t(`working.verb.${kind}`) })
}

const secondsSince = (startedAt: number) =>
	Math.max(0, Math.floor((Date.now() - startedAt) / SECOND))

const formatElapsed = (seconds: number) => {
	const minutes = Math.floor(seconds / 60)
	const rest = seconds % 60
	return minutes > 0
		? `${minutes}m ${String(rest).padStart(2, "0")}s`
		: `${rest}s`
}

type ElapsedClockProps = { startedAt: number }

const ElapsedClock = ({ startedAt }: ElapsedClockProps) => {
	const [seconds, setSeconds] = useState(() => secondsSince(startedAt))

	useEffect(() => {
		const tick = () => setSeconds(secondsSince(startedAt))

		tick()
		const timer = window.setInterval(tick, SECOND)

		return () => window.clearInterval(timer)
	}, [startedAt])

	return (
		<span
			data-slot="bot-working-elapsed"
			className="shrink-0 font-normal text-muted-foreground text-sm tabular-nums"
		>
			{formatElapsed(seconds)}
		</span>
	)
}

function ActivityIndicator(props: ActivityIndicatorProps) {
	const {
		kind = "thinking",
		botId,
		name,
		label,
		waitingOn = "you",
		startedAt,
		animal,
		blot,
		image,
		seed,
		size = TURN_AVATAR_SIZE,
		className,
	} = props
	const { t } = useTranslation("chat")
	const markId = useMarkId(botId)
	const named = name ?? t("working.name")
	const isBusy = kind !== "waiting"
	const text = rowTextOf({ t, kind, name: named, label, waitingOn })
	const avatar = (
		<BotIdentityAvatar
			animal={animal}
			blot={blot}
			image={image}
			kind={kind}
			name={name}
			seed={seed}
			size={size}
			working
		/>
	)

	return (
		<div
			data-slot="bot-working"
			data-kind={kind}
			className={cn("flex min-w-0 items-center gap-2", className)}
		>
			<SharedMark markId={markId} className="shrink-0">
				{props.stoppable ? (
					<BotStopButton image={image} name={named} onStop={props.onStop}>
						{avatar}
					</BotStopButton>
				) : (
					avatar
				)}
			</SharedMark>
			<Tooltip content={text} wrapperClassName="min-w-0 flex-1">
				<span
					data-slot="bot-working-label"
					className="block min-w-0 max-w-full truncate font-medium text-muted-foreground text-sm"
				>
					{isBusy ? (
						<TextShimmer className="inline" duration={WORKING_SHIMMER_DURATION}>
							{text}
						</TextShimmer>
					) : (
						text
					)}
				</span>
			</Tooltip>
			{isBusy && startedAt !== undefined ? (
				<ElapsedClock startedAt={startedAt} />
			) : null}
		</div>
	)
}

export type { ActivityIndicatorKind, ActivityIndicatorWait }
export { ActivityIndicator, type ActivityIndicatorProps }
