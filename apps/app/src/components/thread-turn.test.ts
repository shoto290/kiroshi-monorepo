// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react"
import { type ComponentProps, createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import "@workspace/ui/lib/i18n"

import { ThreadTurn } from "@/components/thread-turn"
import { attachmentBlock } from "@/lib/chat/message-attachments"
import type { TranscriptRow } from "@/lib/chat/screen-model"
import type { TranscriptRole } from "@/lib/conversations/transcript-contract"

afterEach(cleanup)

const FIRST_NAME = "0b7c6d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e.png"
const SECOND_NAME = "1c8d7e2f-3a4b-4c5d-9e0f-1a2b3c4d5e6f.jpg"
const FIRST = `/root/attachments/c-1/${FIRST_NAME}`
const SECOND = `/root/attachments/c-1/${SECOND_NAME}`

const shownWith = (caption: string, paths: string[]) =>
	[caption, attachmentBlock(paths, new Date(0))].join("\n")

const rowOf = (role: TranscriptRole, text: string): TranscriptRow => ({
	messageId: "m-1",
	turnId: "t-1",
	blockIndex: 0,
	quotedMessageId: null,
	authorBotId: role === "assistant" ? "bot-1" : null,
	role,
	text,
	timestamp: 1,
	completion: "complete",
})

const renderTurn = (role: TranscriptRole, text: string) => {
	const props: ComponentProps<typeof ThreadTurn> = {
		row: rowOf(role, text),
		anchor: "m-1",
		state: "complete",
		pinned: false,
		toQuote: () => ({
			author: "",
			excerpt: "",
			from: "user",
			onJump: () => undefined,
		}),
		onPin: () => undefined,
		onReply: () => undefined,
	}
	return render(createElement(ThreadTurn, props))
}

const attachmentButtons = () =>
	screen.getByRole("list", { name: "Attachments" }).querySelectorAll("button")

const previewOf = (name: string) =>
	within(screen.getByRole("button", { name: `Open ${name}` }))
		.getByRole("presentation", { hidden: true })
		.getAttribute("src")

describe("a companion bubble carrying attachments", () => {
	it("shows every image as an attachment and the caption as text, never the path", () => {
		renderTurn("assistant", shownWith("here are both", [FIRST, SECOND]))

		expect(attachmentButtons()).toHaveLength(2)
		expect(previewOf(FIRST_NAME)).toBeTruthy()
		expect(previewOf(SECOND_NAME)).toBeTruthy()
		expect(screen.getByText("here are both")).toBeTruthy()
		expect(document.body.textContent).not.toContain("/root/attachments")
		expect(document.body.textContent).not.toContain("Attached to this message")
	})

	it("shows the same previews as the person bubble for the same attachments", () => {
		const text = shownWith("look", [FIRST])
		renderTurn("user", text)
		const personPreview = previewOf(FIRST_NAME)
		cleanup()

		renderTurn("assistant", text)

		expect(previewOf(FIRST_NAME)).toBe(personPreview)
	})
})
