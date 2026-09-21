import { i18n } from "@workspace/ui/lib/i18n"

const UNITS = [
	["year", 31_536_000_000],
	["month", 2_592_000_000],
	["week", 604_800_000],
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
] as const satisfies readonly (readonly [Intl.RelativeTimeFormatUnit, number])[]

const COMPACT_STEPS = [
	["second", 1000, 60_000],
	["minute", 60_000, 3_600_000],
	["hour", 3_600_000, 86_400_000],
	["day", 86_400_000, 604_800_000],
	["week", 604_800_000, 2_419_200_000],
] as const

const COMPACT_DATE: Intl.DateTimeFormatOptions = {
	month: "numeric",
	day: "numeric",
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>()

const unitFormatters = new Map<string, Intl.NumberFormat>()

const keptOrMade = <Formatter>(
	kept: Map<string, Formatter>,
	key: string,
	make: () => Formatter,
) => {
	const found = kept.get(key)
	if (found) return found

	const made = make()
	kept.set(key, made)
	return made
}

const dateTimeFormatterFor = (options: Intl.DateTimeFormatOptions) => {
	const language = i18n.language

	return keptOrMade(
		dateTimeFormatters,
		`${language}|${JSON.stringify(options)}`,
		() => new Intl.DateTimeFormat(language, options),
	)
}

const relativeTimeFormatter = () => {
	const language = i18n.language

	return keptOrMade(
		relativeTimeFormatters,
		language,
		() => new Intl.RelativeTimeFormat(language, { numeric: "auto" }),
	)
}

const unitFormatterFor = (unit: string) => {
	const language = i18n.language

	return keptOrMade(
		unitFormatters,
		`${language}|${unit}`,
		() =>
			new Intl.NumberFormat(language, {
				style: "unit",
				unit,
				unitDisplay: "narrow",
			}),
	)
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

const toCompactAge = (at: number, now: number) => {
	const age = Math.max(0, now - at)
	const step = COMPACT_STEPS.find(([, , below]) => age < below)
	if (!step) return formatDateTime(at, COMPACT_DATE)

	const [unit, span] = step
	return unitFormatterFor(unit).format(Math.floor(age / span))
}

export { formatDateTime, toCompactAge, toRelativeTime }
