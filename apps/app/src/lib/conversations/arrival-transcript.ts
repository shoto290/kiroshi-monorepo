import type { CompanionArrival, TranscriptMessage } from "./transcript-contract"

import type { TranscriptRow } from "@/lib/chat/screen-model"
import { BEFORE_FIRST_RUN } from "@/lib/missions/mission-transcript"

export type PlacedArrival = {
	arrival: CompanionArrival
	runIndex: number
}

export type PlacedBySeq<Anchored> = {
	anchored: Anchored
	runIndex: number
}

type TranscriptWindow = {
	runs: TranscriptRow[][]
	messages: TranscriptMessage[]
	hasOlder: boolean
}

type SeqPlacement<Anchored> = TranscriptWindow & {
	anchored: Anchored[]
}

type ArrivalPlacement = TranscriptWindow & {
	arrivals: CompanionArrival[]
}

const newestSeqOf = (
	run: TranscriptRow[],
	seqs: ReadonlyMap<string, number>,
): number =>
	run.reduce(
		(newest, { messageId }) => Math.max(newest, seqs.get(messageId) ?? newest),
		Number.NEGATIVE_INFINITY,
	)

const lastRunAtOrBelow = (newestSeqs: number[], lastMessageSeq: number) =>
	newestSeqs.reduce(
		(last, newest, index) => (newest <= lastMessageSeq ? index : last),
		BEFORE_FIRST_RUN,
	)

export const placeBySeq = <Anchored extends { lastMessageSeq: number }>({
	runs,
	messages,
	anchored,
	hasOlder,
}: SeqPlacement<Anchored>): PlacedBySeq<Anchored>[] => {
	const seqs = new Map(messages.map(({ id, seq }) => [id, seq]))
	const newestSeqs = runs.map((run) => newestSeqOf(run, seqs))
	const maskedBelow = hasOlder ? (messages[0]?.seq ?? null) : null

	return anchored
		.filter(
			({ lastMessageSeq }) =>
				maskedBelow === null || lastMessageSeq >= maskedBelow,
		)
		.map((record) => ({
			anchored: record,
			runIndex: lastRunAtOrBelow(newestSeqs, record.lastMessageSeq),
		}))
}

export const placeArrivals = ({
	arrivals,
	...window
}: ArrivalPlacement): PlacedArrival[] =>
	placeBySeq({ ...window, anchored: arrivals }).map(
		({ anchored, runIndex }) => ({ arrival: anchored, runIndex }),
	)
