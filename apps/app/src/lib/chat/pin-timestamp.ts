import { formatDateTime } from "@workspace/ui/lib/time-format"

const STAMP: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
}

export const pinTimestamp = (at: number): string => formatDateTime(at, STAMP)
