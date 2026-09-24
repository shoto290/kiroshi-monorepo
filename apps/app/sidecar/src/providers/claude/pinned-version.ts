import { readFileSync } from "node:fs"
import { join } from "node:path"

const PIN_MANIFEST = join(import.meta.dir, "..", "..", "..", "package.json")
const PIN_MANIFEST_LABEL = "apps/app/sidecar/package.json"

type VersionPin = {
	pinned: string
	resolved: string
}

export const pinnedClaudeCodeVersion = (): string => {
	const manifest = JSON.parse(readFileSync(PIN_MANIFEST, "utf8"))
	const pinned = manifest.claudeCodeVersion
	if (typeof pinned !== "string" || pinned.length === 0) {
		throw new Error(
			`${PIN_MANIFEST_LABEL} carries no claudeCodeVersion field to pin the Claude Code executable.`,
		)
	}
	return pinned
}

export const assertPinnedVersion = ({ pinned, resolved }: VersionPin) => {
	if (resolved === pinned) {
		return
	}
	throw new Error(
		`@anthropic-ai/claude-agent-sdk in node_modules carries Claude Code ${resolved}, but ${PIN_MANIFEST_LABEL} pins ${pinned}. Run bun install to resolve the pinned version.`,
	)
}
