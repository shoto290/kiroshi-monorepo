import { describe, expect, it } from "vitest"

import { promptWithAttachments } from "./attachments"
import {
	messageWithAttachments,
	storedAttachmentPath,
} from "./message-attachments"

const ROOT = "/Users/reader/Library/Application Support/com.kiroshi.app"

const stored = (submittedName: string) =>
	storedAttachmentPath({ root: ROOT, conversationId: "conv-1", submittedName })

const IMAGE = stored("shot.png")
const ARCHIVE = stored("logs.zip")
const MINTED = IMAGE.split("/").at(-1) ?? ""

const SENT_AT = new Date("2026-09-18T10:15:30Z")

const HEADER_OF_TWO =
	"Attached to this message, sent 2026-09-18T10:15:30.000Z, 2 files:"

const sentWith = (text: string, paths: string[]) =>
	promptWithAttachments(text, paths, SENT_AT)

describe("reading back the block a message carries", () => {
	it("takes the block out of the text and hands back its paths as files", () => {
		const lifted = messageWithAttachments(
			sentWith("Have a look at these", [IMAGE, ARCHIVE]),
		)

		expect(lifted.text).toBe("Have a look at these")
		expect(lifted.attachments.map((item) => item.id)).toEqual([IMAGE, ARCHIVE])
	})

	it("keeps every line of a text that ends in none", () => {
		const written = "Nothing attached here\n\nJust two paragraphs"

		const lifted = messageWithAttachments(written)

		expect(lifted.text).toBe(written)
		expect(lifted.attachments).toEqual([])
	})

	it("lifts the paths of a prompt that was only files", () => {
		const lifted = messageWithAttachments(sentWith("", [IMAGE]))

		expect(lifted.text).toBe("")
		expect(lifted.attachments).toHaveLength(1)
	})

	it("keeps a typed line that reads as a stored path above the block", () => {
		const lifted = messageWithAttachments(
			sentWith(`Look at this one\n${IMAGE}`, [ARCHIVE]),
		)

		expect(lifted.text).toBe(`Look at this one\n${IMAGE}`)
		expect(lifted.attachments.map((item) => item.id)).toEqual([ARCHIVE])
	})

	it("reads each message of a conversation back to its own paths", () => {
		const first = stored("first.png")
		const second = stored("second.png")

		const firstRead = messageWithAttachments(sentWith("One", [first]))
		const secondRead = messageWithAttachments(sentWith("Two", [second]))

		expect(firstRead.attachments.map((item) => item.id)).toEqual([first])
		expect(secondRead.attachments.map((item) => item.id)).toEqual([second])
	})
})

describe("a header over lines it did not write", () => {
	it.each([
		["a line with no ordinal", `${HEADER_OF_TWO}\n1/2 ${IMAGE}\n${ARCHIVE}`],
		["a line of prose", `${HEADER_OF_TWO}\n1/2 ${IMAGE}\n2/2 see above`],
		[
			"an ordinal over a path the host never minted",
			`${HEADER_OF_TWO}\n1/2 ${IMAGE}\n2/2 ${ROOT}/attachments/conv-1/shot.png`,
		],
		["fewer lines than it counts", `${HEADER_OF_TWO}\n1/2 ${IMAGE}`],
		["ordinals out of place", `${HEADER_OF_TWO}\n2/2 ${IMAGE}\n1/2 ${ARCHIVE}`],
	])("reads the message back untouched: %s", (_case, block) => {
		const written = `Look\n${block}`

		const lifted = messageWithAttachments(written)

		expect(lifted.text).toBe(written)
		expect(lifted.attachments).toEqual([])
	})
})

describe("reading back the bare paths of an older message", () => {
	it("takes the trailing paths out of the text and hands them back as files", () => {
		const lifted = messageWithAttachments(
			`Have a look at these\n${IMAGE}\n${ARCHIVE}`,
		)

		expect(lifted.text).toBe("Have a look at these")
		expect(lifted.attachments.map((item) => item.id)).toEqual([IMAGE, ARCHIVE])
	})

	it("leaves no trailing blank behind the text it kept", () => {
		expect(messageWithAttachments(`Look\n\n${IMAGE}`).text).toBe("Look")
	})

	it("lifts only the trailing run, leaving a path quoted mid-text alone", () => {
		const lifted = messageWithAttachments(
			`Compare ${IMAGE} with\n${IMAGE}\n${ARCHIVE}`,
		)

		expect(lifted.text).toBe(`Compare ${IMAGE} with`)
		expect(lifted.attachments).toHaveLength(2)
	})
})

describe("a line that only looks like a stored path", () => {
	it.each([
		["a name the host never minted", `${ROOT}/attachments/conv-1/shot.png`],
		[
			"no conversation between the store and the file",
			`${ROOT}/attachments/${MINTED}`,
		],
		[
			"a store the reader keeps themselves",
			`/Users/reader/notes/conv-1/${MINTED}`,
		],
		["a stored path named in prose", `Read ${IMAGE} please`],
		["nothing above the store", `attachments/conv-1/${MINTED}`],
	])("stays in the text: %s", (_case, line) => {
		const lifted = messageWithAttachments(`Look\n${line}`)

		expect(lifted.text).toBe(`Look\n${line}`)
		expect(lifted.attachments).toEqual([])
	})
})

describe("what the bubble is handed", () => {
	it("gives an image a source and everything else its name alone", () => {
		const [image, archive] = messageWithAttachments(
			sentWith("Both", [IMAGE, ARCHIVE]),
		).attachments

		expect(image?.previewUrl).toBe(IMAGE)
		expect(image?.name).toBe(MINTED)
		expect(archive?.previewUrl).toBeUndefined()
		expect(archive?.name).toBe(ARCHIVE.split("/").at(-1))
	})
})
