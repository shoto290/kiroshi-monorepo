"use client"

import { parsePatchFiles } from "@pierre/diffs"
import { PatchDiff } from "@pierre/diffs/react"
import { useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import { CodeBlock } from "@workspace/ui/components/code-block"
import { useColorScheme } from "@workspace/ui/hooks/use-color-scheme"

const PATCH_THEME = {
	dark: "github-dark-high-contrast",
	light: "github-light-high-contrast",
}

const holdsOneFile = (patch: string) => {
	try {
		const patches = parsePatchFiles(patch)
		return patches.length === 1 && patches[0]?.files.length === 1
	} catch {
		return false
	}
}

type CommitDiffProps = {
	patch: string
}

const CommitDiff = ({ patch }: CommitDiffProps) => {
	const { t } = useTranslation("bots")
	const frame = useRef<HTMLDivElement>(null)
	const themeType = useColorScheme(frame)
	const isReadable = useMemo(() => holdsOneFile(patch), [patch])

	if (!isReadable) {
		return (
			<CodeBlock
				code={patch}
				filename={t("history.diff.filename")}
				language="diff"
				showLineNumbers={false}
				wrap
			/>
		)
	}

	return (
		<div
			aria-label={t("history.diff.filename")}
			className="min-w-0 overflow-hidden rounded-xl border"
			ref={frame}
			role="group"
		>
			<PatchDiff
				options={{
					diffStyle: "unified",
					overflow: "wrap",
					theme: PATCH_THEME,
					themeType,
				}}
				patch={patch}
			/>
		</div>
	)
}

export { CommitDiff, type CommitDiffProps }
