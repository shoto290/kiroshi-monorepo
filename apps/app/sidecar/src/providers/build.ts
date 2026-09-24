import { existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

import type { ProviderBuild, StageTarget } from "./provider"

import { claudeBuild } from "./claude/build"

const PROVIDER_BUILDS: ProviderBuild[] = [claudeBuild]

const RENAMED_BINARY_PREFIX = "opennest-"

export const prepareProviders = () =>
	Promise.all(PROVIDER_BUILDS.map((build) => build.prepare()))

const removeRenamedBinaries = (directory: string) => {
	if (!existsSync(directory)) {
		return
	}
	for (const entry of readdirSync(directory)) {
		if (entry.startsWith(RENAMED_BINARY_PREFIX)) {
			rmSync(join(directory, entry), { force: true })
		}
	}
}

export const stageProviders = (target: StageTarget) => {
	removeRenamedBinaries(target.directory)
	for (const build of PROVIDER_BUILDS) {
		build.stage(target)
	}
}
