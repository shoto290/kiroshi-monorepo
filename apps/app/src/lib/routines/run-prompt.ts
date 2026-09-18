import type { RunRequested } from "./routine-contract"

import {
	cutAtCodePoints,
	fenced,
	untrustedNoticeOf,
} from "@/lib/untrusted-data"

export const RUN_PAYLOAD_CHARS = 4000

const UNTRUSTED_NOTICE = untrustedNoticeOf("the trigger payload")

const CUT_NOTICE = `The payload was cut after ${RUN_PAYLOAD_CHARS} characters: it is not the whole payload.`

const payloadText = (payload: unknown) =>
	JSON.stringify(payload ?? null, null, 2)

export const runPromptFor = ({
	instruction,
	payload,
}: RunRequested): string => {
	const { text, isCut } = cutAtCodePoints(
		payloadText(payload),
		RUN_PAYLOAD_CHARS,
	)
	return [
		instruction.trim(),
		isCut ? `${UNTRUSTED_NOTICE} ${CUT_NOTICE}` : UNTRUSTED_NOTICE,
		fenced(text),
	].join("\n\n")
}
