import { cn } from "@workspace/ui/lib/utils"

const CLAUDE_MARK_COLOR = "#D97757"
const CLAUDE_LONG_PETAL = "M12 12 L10.9 3.0 C11.15 1.55 12.85 1.55 13.1 3.0 Z"
const CLAUDE_SHORT_PETAL =
	"M12 12 L11.05 5.6 C11.25 4.35 12.75 4.35 12.95 5.6 Z"
const CLAUDE_LONG_PETAL_ROTATIONS = [
	0, 65.5, 98.2, 163.6, 196.4, 261.8, 294.5, 327.3,
]
const CLAUDE_SHORT_PETAL_ROTATIONS = [32.7, 130.9, 229.1]

const RABBIT_URL = "/kiroshi-rabbit.png"

export const ClaudeMark = () => (
	<svg
		aria-hidden="true"
		className="size-[13px] shrink-0"
		fill={CLAUDE_MARK_COLOR}
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		{CLAUDE_LONG_PETAL_ROTATIONS.map((rotation) => (
			<path
				d={CLAUDE_LONG_PETAL}
				key={rotation}
				transform={`rotate(${rotation} 12 12)`}
			/>
		))}
		{CLAUDE_SHORT_PETAL_ROTATIONS.map((rotation) => (
			<path
				d={CLAUDE_SHORT_PETAL}
				key={rotation}
				transform={`rotate(${rotation} 12 12)`}
			/>
		))}
	</svg>
)

export const DownloadMark = () => (
	<svg
		aria-hidden="true"
		className="size-[15px] shrink-0"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth={1.5}
		viewBox="0 0 16 16"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M8 2v8m0 0 3.2-3.2M8 10 4.8 6.8M2.6 12.4h10.8" />
	</svg>
)

type RabbitMarkProps = {
	className: string
}

export const RabbitMark = ({ className }: RabbitMarkProps) => (
	<img
		alt=""
		aria-hidden="true"
		className={cn(
			"pointer-events-none absolute object-cover object-center",
			className,
		)}
		src={RABBIT_URL}
	/>
)
