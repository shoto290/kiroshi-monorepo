import { useCallback, useEffect, useRef, useState } from "react"

const INVALID_CONTROL = '[aria-invalid="true"]'

const FOCUSABLE =
	'input:not([type="hidden"]):not([tabindex="-1"]), textarea, select, button:not([tabindex="-1"]), [tabindex="0"]'

const focusTargetIn = (invalid: HTMLElement) =>
	invalid.matches(FOCUSABLE)
		? invalid
		: invalid.querySelector<HTMLElement>(FOCUSABLE)

export const useFocusFirstInvalid = <Root extends HTMLElement>() => {
	const root = useRef<Root>(null)
	const [request, setRequest] = useState(0)

	useEffect(() => {
		if (request === 0) return
		const invalid = root.current?.querySelector<HTMLElement>(INVALID_CONTROL)
		if (invalid) focusTargetIn(invalid)?.focus()
	}, [request])

	const focusFirstInvalid = useCallback(
		() => setRequest((count) => count + 1),
		[],
	)

	return { root, focusFirstInvalid }
}
