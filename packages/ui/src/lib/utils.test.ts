import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const VENDORED_DIRECTORY = join(import.meta.dirname, "../components/ui")
const FOREIGN_CN_IMPORT = /from\s+["']cn["']/

const vendoredFilesImportingForeignCn = () =>
	readdirSync(VENDORED_DIRECTORY).filter((file) =>
		FOREIGN_CN_IMPORT.test(
			readFileSync(join(VENDORED_DIRECTORY, file), "utf8"),
		),
	)

describe("cn", () => {
	it("is the one from @workspace/ui/lib/utils in every vendored primitive", () => {
		expect(vendoredFilesImportingForeignCn()).toEqual([])
	})

	it("is not a dependency of the ui package", () => {
		const { dependencies, devDependencies } = JSON.parse(
			readFileSync(join(import.meta.dirname, "../../package.json"), "utf8"),
		)
		expect(dependencies).not.toHaveProperty("cn")
		expect(devDependencies).not.toHaveProperty("cn")
	})
})
