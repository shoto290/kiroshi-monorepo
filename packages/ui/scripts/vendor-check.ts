import { readdir } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { $ } from "bun"

const VENDOR_DIR = "src/components/ui"

const vendorFilePaths = async () => {
	const entries = await readdir(VENDOR_DIR, {
		recursive: true,
		withFileTypes: true,
	})

	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.sort()
}

const registryItemOf = (path: string) => basename(path, extname(path))

const actionOf = (output: string, path: string) => {
	const marker = `${path} (`
	const line = output
		.split("\n")
		.find((candidate) => candidate.includes(marker))

	return line?.split(marker)[1]?.split(")")[0]
}

const indented = (output: string) =>
	output
		.split("\n")
		.map((line) => `    ${line}`)
		.join("\n")

const divergenceOf = async (path: string) => {
	const item = registryItemOf(path)
	const result = await $`bunx shadcn add ${item} --diff ${path}`
		.env({ ...process.env, NO_COLOR: "1" })
		.nothrow()
		.quiet()
	const output = `${result.stdout}${result.stderr}`.trim()
	const action = result.exitCode === 0 ? actionOf(output, path) : undefined

	if (action === "skip") return null

	const reason = action
		? `diverges from the registry item "${item}" (${action})`
		: `could not be compared against the registry item "${item}"`

	return `${path}: ${reason}\n${indented(output)}`
}

const paths = await vendorFilePaths()
const divergences = (await Promise.all(paths.map(divergenceOf))).filter(
	(divergence) => divergence !== null,
)

if (divergences.length > 0) {
	console.error(`${VENDOR_DIR} does not match the registry:\n`)
	for (const divergence of divergences) console.error(`  ${divergence}\n`)
	console.error(
		"Reinstall the file with the shadcn CLI, never edit it by hand.",
	)
	process.exit(1)
}

console.log(`${VENDOR_DIR}: ${paths.length} file(s) match the registry.`)
