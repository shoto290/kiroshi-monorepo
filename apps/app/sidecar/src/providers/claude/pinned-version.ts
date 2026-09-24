import { readFileSync } from "node:fs"
import { join } from "node:path"

const PIN_MANIFEST = join(import.meta.dir, "..", "..", "..", "package.json")
const PIN_MANIFEST_LABEL = "apps/app/sidecar/package.json"
const RELEASE_SEGMENTS = 3

const BUMP_REMEDY = `bump claudeCodeVersion in ${PIN_MANIFEST_LABEL}`
const INSTALL_REMEDY = "run bun install to resolve the pinned version"

type SidecarManifest = {
	claudeCodeVersion?: unknown
}

type VersionPin = {
	pinned: string
	resolved: string
}

export const readPinnedVersion = (manifest: SidecarManifest): string => {
	const pinned = manifest.claudeCodeVersion
	if (typeof pinned !== "string") {
		throw new Error(
			`${PIN_MANIFEST_LABEL} carries no claudeCodeVersion string, so the Claude Code executable is not pinned.`,
		)
	}
	return pinned
}

export const pinnedClaudeCodeVersion = (): string =>
	readPinnedVersion(JSON.parse(readFileSync(PIN_MANIFEST, "utf8")))

const releaseSegments = (version: string) => {
	const segments = version.split(".")
	if (segments.length !== RELEASE_SEGMENTS) {
		return null
	}
	const numbers = segments.map(Number)
	return numbers.every(Number.isInteger) ? numbers : null
}

const isAheadOfPin = (resolved: number[], pinned: number[]) => {
	for (const [index, segment] of resolved.entries()) {
		if (segment !== pinned[index]) {
			return segment > pinned[index]
		}
	}
	return false
}

const remedyFor = ({ pinned, resolved }: VersionPin) => {
	const pinnedRelease = releaseSegments(pinned)
	const resolvedRelease = releaseSegments(resolved)
	if (!pinnedRelease || !resolvedRelease) {
		return `Either ${INSTALL_REMEDY}, or ${BUMP_REMEDY}.`
	}
	return isAheadOfPin(resolvedRelease, pinnedRelease)
		? `The dependency moved ahead of the pin: ${BUMP_REMEDY} to ${resolved}.`
		: `The install lags behind the pin: ${INSTALL_REMEDY}.`
}

export const assertPinnedVersion = ({ pinned, resolved }: VersionPin) => {
	if (resolved === pinned) {
		return
	}
	throw new Error(
		`@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code ${resolved}, but ${PIN_MANIFEST_LABEL} pins ${pinned}. ${remedyFor({ pinned, resolved })}`,
	)
}
