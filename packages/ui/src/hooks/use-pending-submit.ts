import { useState } from "react"

export const usePendingSubmit = () => {
	const [isPending, setPending] = useState(false)

	const run = (submit: () => unknown) => {
		const request = submit()
		if (!(request instanceof Promise)) return
		setPending(true)
		void request.finally(() => setPending(false))
	}

	return { isPending, run }
}
