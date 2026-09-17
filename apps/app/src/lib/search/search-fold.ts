import type { SearchResultTitlePart } from "@workspace/ui/components/search-result-row"

const COMBINING_MARKS = /\p{M}/gu

export const folded = (text: string): string =>
	text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase()

type Folding = {
	text: string
	originOf: number[]
}

const foldedWithOrigins = (chars: string[]): Folding => {
	const originOf: number[] = []
	let text = ""

	chars.forEach((char, index) => {
		for (const foldedChar of folded(char)) {
			text += foldedChar
			originOf.push(index)
		}
	})

	return { text, originOf }
}

const partsOf = (chars: string[], from: number, to: number) => [
	{ key: "head", text: chars.slice(0, from).join("") },
	{ key: "match", text: chars.slice(from, to).join(""), isMatch: true },
	{ key: "tail", text: chars.slice(to).join("") },
]

export const markedTitle = (
	title: string,
	query: string,
): SearchResultTitlePart[] => {
	const needle = folded(query.trim())
	const chars = [...title]
	const whole = [{ key: "title", text: title }]

	if (needle === "") {
		return whole
	}

	const { text, originOf } = foldedWithOrigins(chars)
	const start = text.indexOf(needle)

	if (start === -1) {
		return whole
	}

	const from = originOf[start]
	const to = originOf[start + needle.length - 1] + 1

	return partsOf(chars, from, to).filter((part) => part.text !== "")
}
