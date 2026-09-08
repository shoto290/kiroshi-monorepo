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

const paths = await vendorFilePaths()
const items = [...new Set(paths.map(registryItemOf))]
const comparison = await $`bunx shadcn add ${items} --diff ${VENDOR_DIR}`
	.env({ ...process.env, NO_COLOR: "1" })
	.nothrow()
	.quiet()
const output = `${comparison.stdout}${comparison.stderr}`.trim()

if (comparison.exitCode !== 0) {
	console.error(
		`${VENDOR_DIR} could not be compared against the registry, the shadcn CLI failed:\n`,
	)
	console.error(indented(output))
	process.exit(1)
}

const comparisons = paths.map((path) => ({
	path,
	action: actionOf(output, path),
}))
const uncompared = comparisons.filter(({ action }) => !action)
const divergent = comparisons.filter(
	({ action }) => action && action !== "skip",
)

if (uncompared.length === 0 && divergent.length === 0) {
	console.log(`${VENDOR_DIR}: ${paths.length} file(s) match the registry.`)
	process.exit(0)
}

console.error(`${VENDOR_DIR} does not match the registry:\n`)

for (const { path } of uncompared) {
	console.error(
		`  ${path}: the shadcn CLI printed no comparison for this file\n`,
	)
}

for (const { path, action } of divergent) {
	const item = registryItemOf(path)

	console.error(
		[
			`  ${path} (${action}), from one of two causes:`,
			`    a hand edit of the vendor file: revert it with \`git checkout -- packages/ui/${path}\`, then put the added behaviour in a composed component beside the folder.`,
			`    a new upstream release of the "${item}" registry item: review the diff below, reinstall it with \`bunx shadcn add ${item} --overwrite\` from packages/ui, then adapt its consumers.`,
			`    \`git log -1 -- packages/ui/${path}\` tells them apart: no local commit on the file means the change came from upstream.\n`,
		].join("\n"),
	)
}

console.error(indented(output))
process.exit(1)
