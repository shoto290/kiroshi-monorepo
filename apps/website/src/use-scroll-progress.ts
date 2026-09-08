import { useEffect, useState } from "react"

const readProgress = () => {
	const range = document.documentElement.scrollHeight - window.innerHeight
	if (range <= 0) return 0

	return Math.min(Math.max(window.scrollY / range, 0), 1)
}

export const useScrollProgress = (isEnabled: boolean) => {
	const [progress, setProgress] = useState(0)

	useEffect(() => {
		if (!isEnabled) return

		let frame = 0
		const read = () => {
			frame = 0
			setProgress(readProgress())
		}
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}

		read()
		window.addEventListener("scroll", schedule, { passive: true })
		window.addEventListener("resize", schedule)

		return () => {
			window.removeEventListener("scroll", schedule)
			window.removeEventListener("resize", schedule)
			cancelAnimationFrame(frame)
		}
	}, [isEnabled])

	return isEnabled ? progress : 0
}
