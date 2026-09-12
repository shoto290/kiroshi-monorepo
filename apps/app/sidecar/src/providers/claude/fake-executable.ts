import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { EXECUTABLE_OVERRIDE_ENV } from "./executable"

const EXECUTABLE_MODE = 0o755

const SHELL_ADDED_KEYS = new Set(["PWD", "OLDPWD", "SHLVL", "_"])

export const pointAtFakeExecutable = (directory: string, script: string) => {
	const path = join(directory, "claude")
	writeFileSync(path, `#!/bin/sh\n${script}\n`)
	chmodSync(path, EXECUTABLE_MODE)
	process.env[EXECUTABLE_OVERRIDE_ENV] = path
}

export const recordedEnv = (path: string): Record<string, string> =>
	Object.fromEntries(
		readFileSync(path, "utf8")
			.split("\n")
			.filter((line) => line.includes("="))
			.map((line) => {
				const separator = line.indexOf("=")
				return [line.slice(0, separator), line.slice(separator + 1)] as const
			})
			.filter(([key]) => !SHELL_ADDED_KEYS.has(key)),
	)
