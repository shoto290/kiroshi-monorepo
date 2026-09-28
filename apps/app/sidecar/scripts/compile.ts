import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

const signAdHoc = (outfile: string) => {
	const signing = Bun.spawnSync(
		["codesign", "--force", "--sign", "-", outfile],
		{
			stdio: ["inherit", "inherit", "inherit"],
		},
	)
	if (!signing.success) {
		throw new Error(`codesign could not sign ${outfile}`)
	}
}

export const compile = (entry: string, outfile: string) => {
	mkdirSync(dirname(outfile), { recursive: true })
	const build = Bun.spawnSync(
		["bun", "build", "--compile", entry, "--outfile", outfile],
		{ stdio: ["inherit", "inherit", "inherit"] },
	)
	if (!build.success) {
		throw new Error(`bun build --compile failed for ${outfile}`)
	}
	if (process.platform === "darwin") {
		signAdHoc(outfile)
	}
}
