import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const COMPONENTS = join(ROOT, "packages/ui/src/components")
const RESOURCES = join(ROOT, "apps/ios/Kiroshi/Resources")
const GLOBAL_ENTRY = "companion-avatar-global"

const result = await Bun.build({
	entrypoints: [GLOBAL_ENTRY],
	root: ROOT,
	format: "iife",
	plugins: [
		{
			name: GLOBAL_ENTRY,
			setup: (build) => {
				build.onResolve({ filter: new RegExp(`^${GLOBAL_ENTRY}$`) }, () => ({
					path: GLOBAL_ENTRY,
					namespace: GLOBAL_ENTRY,
				}))
				build.onLoad({ filter: /.*/, namespace: GLOBAL_ENTRY }, () => ({
					contents: `import { companionAvatar } from "${join(COMPONENTS, "companion-avatar.ts")}"\nglobalThis.companionAvatar = companionAvatar\n`,
					loader: "ts",
				}))
			},
		},
	],
})

if (!result.success)
	throw new AggregateError(result.logs, "avatar:build failed")

await Bun.write(
	join(RESOURCES, "companion-avatar.js"),
	await result.outputs[0].text(),
)
