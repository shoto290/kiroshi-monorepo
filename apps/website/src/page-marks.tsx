import { cn } from "@workspace/ui/lib/utils"

const RABBIT_URL = `${import.meta.env.BASE_URL}kiroshi-rabbit.png`

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
