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
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}

		window.addEventListener("scroll", onScroll, { passive: true })

		return () => {
			window.removeEventListener("scroll", onScroll)
			cancelAnimationFrame(frame)
		}
	}, [isEnabled])

	return isEnabled ? progress : 0
}
