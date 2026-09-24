import {
	chmodSync,
	copyFileSync,
	linkSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

import {
	BUNDLED_EXECUTABLE_NAME,
	EXECUTABLE_EXTENSION,
	externalBinaryName,
} from "./executable-name"
import { assertPinnedVersion, pinnedClaudeCodeVersion } from "./pinned-version"

import type { ProviderBuild, StageTarget } from "../provider"

const SDK_PACKAGE = "@anthropic-ai/claude-agent-sdk"
const SOURCE_EXECUTABLE_NAME = `claude${EXECUTABLE_EXTENSION}`
const EXECUTABLE_MODE = 0o755

const moduleRoot = import.meta.dir
const generatedModule = join(moduleRoot, "generated", "manifest.ts")

const sdkDirectory = () => dirname(Bun.resolveSync(SDK_PACKAGE, moduleRoot))

export const claudeSourceExecutable = () => {
	const specifier = `${SDK_PACKAGE}-${process.platform}-${process.arch}/${SOURCE_EXECUTABLE_NAME}`
	try {
		return Bun.resolveSync(specifier, sdkDirectory())
	} catch {
		throw new Error(
			`Cannot resolve ${specifier}. Reinstall dependencies without --omit=optional so the native Claude Code binary is available.`,
		)
	}
}

type GeneratedModuleContent = {
	executableVersion: string
	sdkVersion: string
}

const writeGeneratedModule = ({
	executableVersion,
	sdkVersion,
}: GeneratedModuleContent) => {
	mkdirSync(dirname(generatedModule), { recursive: true })
	writeFileSync(
		generatedModule,
		[
			`export const EXECUTABLE_VERSION = ${JSON.stringify(executableVersion)}`,
			`export const SDK_VERSION = ${JSON.stringify(sdkVersion)}`,
			"",
		].join("\n"),
	)
}

const assertStagedVersion = (executable: string) => {
	const pinned = pinnedClaudeCodeVersion()
	const run = Bun.spawnSync([executable, "--version"])
	const output = `${run.stdout.toString()}${run.stderr.toString()}`.trim()
	if (run.exitCode === 0 && output.includes(pinned)) {
		return
	}
	throw new Error(
		`${executable} --version exited ${run.exitCode} and reported "${output}", which does not carry the pinned Claude Code version ${pinned}.`,
	)
}

const stageExecutable = ({ directory, targetTriple }: StageTarget) => {
	mkdirSync(directory, { recursive: true })
	const external = join(directory, externalBinaryName(targetTriple))
	const bundled = join(directory, BUNDLED_EXECUTABLE_NAME)
	rmSync(external, { force: true })
	rmSync(bundled, { force: true })
	copyFileSync(claudeSourceExecutable(), external)
	chmodSync(external, EXECUTABLE_MODE)
	linkSync(external, bundled)
	assertStagedVersion(external)
}

export const claudeBuild: ProviderBuild = {
	prepare: async () => {
		const manifest = await Bun.file(join(sdkDirectory(), "package.json")).json()
		assertPinnedVersion({
			pinned: pinnedClaudeCodeVersion(),
			resolved: manifest.claudeCodeVersion,
		})
		writeGeneratedModule({
			executableVersion: manifest.claudeCodeVersion,
			sdkVersion: manifest.version,
		})
	},
	stage: stageExecutable,
}
