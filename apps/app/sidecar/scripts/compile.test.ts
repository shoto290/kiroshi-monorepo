import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { compile } from "./compile"

const SIDECAR_ENTRY = join(dirname(import.meta.dir), "src", "index.ts")
const USAGE_EXIT = 64

test("the compiled sidecar launches on this host", () => {
	const directory = mkdtempSync(join(tmpdir(), "sidecar-compile-"))
	try {
		const outfile = join(directory, "kiroshi-agent")

		compile(SIDECAR_ENTRY, outfile)
		const launched = Bun.spawnSync([outfile])

		expect(launched.signalCode ?? null).toBeNull()
		expect(launched.exitCode).toBe(USAGE_EXIT)
		expect(launched.stderr.toString()).toContain("usage: kiroshi-agent")
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
}, 60_000)
