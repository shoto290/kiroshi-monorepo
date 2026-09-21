const CONTROL_FILLS = [
	"bg-window-close",
	"bg-window-minimize",
	"bg-window-zoom",
]

export const WindowControls = () => (
	<span
		aria-hidden="true"
		className="pointer-events-none absolute top-[18px] left-3 z-20 flex items-center gap-2"
	>
		{CONTROL_FILLS.map((fill) => (
			<span className={`size-3 rounded-full ${fill}`} key={fill} />
		))}
	</span>
)
