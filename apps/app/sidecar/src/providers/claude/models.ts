import { tmpdir } from "node:os"

import { query } from "@anthropic-ai/claude-agent-sdk"

import { resolveExecutable } from "./executable"
import { createPromptStream } from "./prompt-stream"
import { sessionEnv } from "./session-env"

export const modelsOptions = (connection?: Record<string, string>) => ({
	cwd: tmpdir(),
	pathToClaudeCodeExecutable: resolveExecutable(),
	env: sessionEnv(connection),
	stderr: () => {},
})

const UNRESOLVED_MODEL = "default"

export const offeredModels = (offered: readonly { value: string }[]) =>
	offered
		.map((model) => model.value)
		.filter((value) => value !== UNRESOLVED_MODEL)

export const claudeModels = async (connection?: Record<string, string>) => {
	const prompts = createPromptStream()
	const run = query({
		prompt: prompts.stream,
		options: modelsOptions(connection),
	})
	try {
		return offeredModels(await run.supportedModels())
	} finally {
		prompts.end()
		run.close()
	}
}
