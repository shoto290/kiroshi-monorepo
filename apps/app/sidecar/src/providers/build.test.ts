import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { removeRenamedBinaries } from "./build"

describe("removeRenamedBinaries", () => {
	test("deletes the opennest prefixed binaries and keeps the others", () => {
		const directory = mkdtempSync(join(tmpdir(), "renamed-binaries-"))
		const renamed = join(directory, "opennest-claude-aarch64-apple-darwin")
		const current = join(directory, "kiroshi-claude-aarch64-apple-darwin")
		writeFileSync(renamed, "")
		writeFileSync(current, "")

		removeRenamedBinaries(directory)

		expect(existsSync(renamed)).toBe(false)
		expect(existsSync(current)).toBe(true)
	})

	test("does nothing when the directory does not exist", () => {
		const directory = join(
			mkdtempSync(join(tmpdir(), "renamed-binaries-")),
			"binaries",
		)

		expect(() => removeRenamedBinaries(directory)).not.toThrow()
		expect(existsSync(directory)).toBe(false)
	})
})
