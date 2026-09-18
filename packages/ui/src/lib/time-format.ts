import { i18n } from "@workspace/ui/lib/i18n"

const UNITS = [
	["year", 31_536_000_000],
	["month", 2_592_000_000],
	["week", 604_800_000],
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
] as const satisfies readonly (readonly [Intl.RelativeTimeFormatUnit, number])[]

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>()

const dateTimeFormatterFor = (options: Intl.DateTimeFormatOptions) => {
	const language = i18n.language
	const key = `${language}|${JSON.stringify(options)}`
	const kept = dateTimeFormatters.get(key)
	if (kept) return kept

	const made = new Intl.DateTimeFormat(language, options)
	dateTimeFormatters.set(key, made)
	return made
}

const relativeTimeFormatter = () => {
	const language = i18n.language
	const kept = relativeTimeFormatters.get(language)
	if (kept) return kept

	const made = new Intl.RelativeTimeFormat(language, { numeric: "auto" })
	relativeTimeFormatters.set(language, made)
	return made
}

const formatDateTime = (
	at: number | Date,
	options: Intl.DateTimeFormatOptions,
) => dateTimeFormatterFor(options).format(at)

const toRelativeTime = (at: number, now: number) => {
	const format = relativeTimeFormatter()
	const elapsed = at - now

	for (const [unit, span] of UNITS) {
		if (Math.abs(elapsed) >= span) {
			return format.format(Math.round(elapsed / span), unit)
		}
	}

	return format.format(0, "second")
}

export { formatDateTime, toRelativeTime }
