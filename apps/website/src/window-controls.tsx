const CONTROL_COLORS = ["#FF5F57", "#FEBC2E", "#28C840"]

export const WindowControls = () => (
	<span
		aria-hidden="true"
		className="absolute top-[18px] left-3 flex items-center gap-2"
	>
		{CONTROL_COLORS.map((color) => (
			<span
				className="size-3 rounded-full"
				key={color}
				style={{ backgroundColor: color }}
			/>
		))}
	</span>
)
