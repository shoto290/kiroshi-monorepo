import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { CodeBlock } from "@workspace/ui/components/code-block"
import {
	CODE_LANGUAGES,
	type CodeLanguage,
} from "@workspace/ui/lib/code-highlight"

const MULTI_FILE_PATCH = `diff --git a/packages/core/src/nest/run-history.ts b/packages/core/src/nest/run-history.ts
--- a/packages/core/src/nest/run-history.ts
+++ b/packages/core/src/nest/run-history.ts
@@ -12,7 +12,7 @@
-const RUN_HISTORY_TABLE = "nest_runs"
+const RUN_HISTORY_TABLE = "nest_run_history"
diff --git a/packages/core/src/nest/summarise.ts b/packages/core/src/nest/summarise.ts
--- a/packages/core/src/nest/summarise.ts
+++ b/packages/core/src/nest/summarise.ts
@@ -4,3 +4,3 @@
-	const occupants = nest.occupants
+	const occupants = nest.occupants ?? []`

const LANGUAGE_SAMPLES: Record<CodeLanguage, string> = {
	bash: `bun install\nbun run storybook --port 6006`,
	css: `.nest-card {\n\tdisplay: grid;\n\tgap: 0.5rem;\n\tcolor: var(--foreground);\n}`,
	diff: `- const occupants = nest.occupants\n+ const occupants = nest.occupants ?? []`,
	html: `<article class="nest-card">\n\t<h2>Nest 42</h2>\n\t<p>3 occupants</p>\n</article>`,
	json: `{\n\t"id": "nest_42",\n\t"occupants": 3,\n\t"archived": false\n}`,
	markdown: `# Nest 42\n\n- 3 occupants\n- archived: **no**`,
	python: `def summarise(nest_id: str) -> dict:\n\tnest = read_nest(nest_id)\n\treturn {"id": nest.id, "occupants": len(nest.occupants)}`,
	rust: `pub fn summarise(nest: &Nest) -> usize {\n\tnest.occupants.iter().filter(|o| o.active).count()\n}`,
	text: `Nest 42 is missing two occupants.\nRe-run the sync before archiving it.`,
	tsx: `export const NestBadge = ({ label }: { label: string }) => (\n\t<span className="rounded-full px-2">{label}</span>\n)`,
	typescript: `export const nestId = "nest_42" as const\nexport type NestId = typeof nestId`,
	yaml: `nest: nest_42\noccupants: 3\narchived: false`,
}

const meta = preview.meta({
	title: "Conversation/Markdown/CodeBlock",
	component: CodeBlock,
	parameters: {
		docs: {
			description: {
				component:
					"Renders a patch as the history panel hands it over: highlighting is synchronous and bundled — no grammar is fetched at runtime, so the same code always paints the same tokens. `packages/ui/src/components/plugin-settings/commit-diff.tsx:37` is its only caller, and it reaches for this block when a commit touches more than one file and the rich diff reader cannot take it.",
			},
		},
	},
	args: {
		code: MULTI_FILE_PATCH,
		filename: "Changes",
		language: "diff",
		showLineNumbers: false,
		wrap: true,
	},
	decorators: [
		(Story) => <div className="w-[44rem] max-w-full">{Story()}</div>,
	],
})

export const MultiFilePatch = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The fallback `packages/ui/src/components/plugin-settings/commit-diff.tsx:37` takes when a patch touches more than one file. Check that the file headers and both hunks are readable in one pass, that no line-number gutter competes with the `+`/`-` column the patch already carries, and that long lines wrap rather than scrolling sideways — the reader is looking for what changed, not aiming at a viewport.",
			},
		},
	},
	play: async ({ canvas }) => {
		const viewport = canvas.getByRole("group", {
			name: "Code snippet, Changes",
		})

		await expect(canvas.getAllByText(/run-history/).length).toBeGreaterThan(1)
		await expect(canvas.getAllByText(/summarise/).length).toBeGreaterThan(1)
		await expect(viewport.scrollWidth).toBe(viewport.clientWidth)
	},
})

export const Languages = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"Every grammar bundled today, one block each — a column no panel assembles, since `packages/ui/src/components/plugin-settings/commit-diff.tsx:40` always asks for `diff`. Check that each sample is actually tokenised — `text` is the deliberate exception and stays monochrome. A language added to `CODE_LANGUAGES` without a sample here is a type error, so this matrix cannot drift.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-4">
			{CODE_LANGUAGES.map((language) => (
				<CodeBlock
					{...args}
					key={language}
					code={LANGUAGE_SAMPLES[language]}
					language={language}
				/>
			))}
		</div>
	),
})

export const Copy = meta.story({
	args: { onCopy: fn() },
	parameters: {
		docs: {
			description: {
				story:
					"The copy affordance the header carries for every patch `packages/ui/src/components/plugin-settings/commit-diff.tsx:37` renders, driven through a stubbed `onCopy` so the story never touches the real clipboard. Check that the button is reachable by keyboard, that the icon swaps to a check, and that the result is announced in the polite live region rather than by the icon alone. A rejected copy announces the failure through the same region.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const copy = canvas.getByRole("button", { name: "Copy code" })

		await userEvent.click(copy)

		await expect(args.onCopy).toHaveBeenCalledTimes(1)
		await expect(
			await canvas.findByText("Code copied to clipboard"),
		).toBeInTheDocument()
	},
})
