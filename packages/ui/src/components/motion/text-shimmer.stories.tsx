import preview from "@workspace/storybook/preview"
import {
	TextShimmer,
	WORKING_SHIMMER_DURATION,
} from "@workspace/ui/components/motion/text-shimmer"

const meta = preview.meta({
	title: "Primitives/TextShimmer",
	component: TextShimmer,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"Text that reads as still working. A light band sweeps across the glyphs on a loop, from `--muted-foreground` through `--foreground` and back, by clipping a gradient to the text rather than painting anything on top of it. Reach for it on a label whose work has no measurable progress — a turn being drafted, a tool still thinking — and drop it the moment there is a number to show, where a progress bar says more. It is a single looping CSS animation with no exit: it stops when the label is replaced, so keep the swap in the caller. Two cautions carry: the glyphs are painted through `bg-clip-text` on transparent text, so the label must never be the only copy of a status a reader needs, and under `prefers-reduced-motion` it drops the gradient and settles on `--muted-foreground` rather than sweeping.",
			},
		},
	},
	args: {
		children: "Drafting the release note",
		duration: WORKING_SHIMMER_DURATION,
	},
	argTypes: {
		children: { control: "text" },
		duration: { control: { type: "number", min: 0.5, step: 0.5 } },
		as: { control: false },
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The nominal case: a short status label, sweeping on the working duration every call site passes. Check that the band crosses left to right without a seam at the wrap point, and that the darkest phase still reads as body text rather than as a disabled label.",
			},
		},
	},
})

export const LongContent = meta.story({
	tags: ["test-only"],
	render: () => (
		<p className="max-w-sm text-sm leading-6">
			<TextShimmer>
				Reading every file the last commit touched, then summarising what
				changed
			</TextShimmer>
		</p>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A sentence long enough to wrap. The gradient is sized to the whole box, so every line sweeps in step rather than each one running its own band — check that the effect still reads as one surface and not as several. Reach for `Playground` instead wherever the label fits on one line; anything this long is usually a sign the status belongs in a sentence that is not animated.",
			},
		},
	},
})
