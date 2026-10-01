import { describe, expect, it } from "vitest"

import { LOCAL_COMMANDS } from "./joined-hosts"

const APP_SOURCES: Record<string, string> = import.meta.glob(
	["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}", "!../bindings.ts"],
	{ query: "?raw", import: "default", eager: true },
)
const COMMANDS_IMPORT =
	/import\s*\{[^}]*\bcommands\b[^}]*\}\s*from\s*["'][^"']*bindings["']/
const COMMAND_CALL = /\bcommands\.([a-z][A-Za-z0-9]*)\(/g

type CommandCall = {
	file: string
	command: string
}

const toSnakeCase = (name: string): string =>
	name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

const callsIn = ([file, source]: [string, string]): CommandCall[] => {
	if (!COMMANDS_IMPORT.test(source)) {
		return []
	}
	return [...source.matchAll(COMMAND_CALL)].map(([, name = ""]) => ({
		file,
		command: toSnakeCase(name),
	}))
}

const generatedCommandCalls = (): CommandCall[] =>
	Object.entries(APP_SOURCES).flatMap(callsIn)

const describeRemoteCall = ({ file, command }: CommandCall): string =>
	`${file} calls the generated command ${command}, which is not in LOCAL_COMMANDS: a remote-bound generated command needs the exported invoke from lib/host or a binding generator change, since the generated bindings always reach the local host`

describe("the generated command call sites", () => {
	it("finds the generated commands the app calls", () => {
		expect(generatedCommandCalls().map(({ command }) => command)).toEqual(
			expect.arrayContaining([
				"joined_space_connect",
				"window_declare_maximize_button",
				"host_share_link",
			]),
		)
	})

	it("calls only local commands through the generated bindings", () => {
		const remoteCalls = generatedCommandCalls()
			.filter(({ command }) => !LOCAL_COMMANDS.has(command))
			.map(describeRemoteCall)

		expect(remoteCalls, remoteCalls.join("\n")).toEqual([])
	})
})
