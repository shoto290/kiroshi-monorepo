import { useTranslation } from "react-i18next"

import { Separator } from "@workspace/ui/components/ui/separator"
import { formatDateTime } from "@workspace/ui/lib/time-format"

type DaySeparatorProps = {
	at: number
	now: number
}

const localDayOf = (at: number) => new Date(at).toDateString()

const dayBefore = (at: number) => {
	const before = new Date(at)
	before.setDate(before.getDate() - 1)
	return before.getTime()
}

const isSameYear = (at: number, now: number) =>
	new Date(at).getFullYear() === new Date(now).getFullYear()

const DaySeparator = ({ at, now }: DaySeparatorProps) => {
	const { t } = useTranslation("chat")
	const day = localDayOf(at)
	const label =
		day === localDayOf(now)
			? t("transcript.day.today")
			: day === localDayOf(dayBefore(now))
				? t("transcript.day.yesterday")
				: formatDateTime(at, {
						day: "numeric",
						month: "long",
						...(isSameYear(at, now) ? {} : { year: "numeric" }),
					})

	return (
		<div
			data-slot="day-separator"
			className="flex items-center gap-3 text-muted-foreground text-xs"
		>
			<Separator aria-hidden="true" className="flex-1" />
			<span className="shrink-0">{label}</span>
			<Separator aria-hidden="true" className="flex-1" />
		</div>
	)
}

export { DaySeparator }
