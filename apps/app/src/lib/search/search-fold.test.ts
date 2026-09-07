import { expect, it } from "vitest"

import { markedTitle } from "./search-fold"

it("marks the run the query matches", () => {
	expect(markedTitle("Roadmap review", "map")).toEqual([
		{ key: "head", text: "Road" },
		{ key: "match", text: "map", isMatch: true },
		{ key: "tail", text: " review" },
	])
})

it("marks under the fold the catalogue matches on", () => {
	expect(markedTitle("Amélie", "AME")).toEqual([
		{ key: "match", text: "Amé", isMatch: true },
		{ key: "tail", text: "lie" },
	])
})

it("leaves a title the query does not match whole", () => {
	expect(markedTitle("Roadmap review", "parser")).toEqual([
		{ key: "title", text: "Roadmap review" },
	])
})

it("leaves a title whole while the query is empty", () => {
	expect(markedTitle("Roadmap review", "   ")).toEqual([
		{ key: "title", text: "Roadmap review" },
	])
})
