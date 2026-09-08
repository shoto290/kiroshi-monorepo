export const TOUCH_GESTURE_CONTENT_CLASS =
	"select-text [-webkit-touch-callout:none] pointer-coarse:select-none"

export function capturePointer(element: Element, pointerId: number) {
	try {
		element.setPointerCapture(pointerId)
	} catch {}
}

export function releasePointer(element: Element, pointerId: number) {
	try {
		if (element.hasPointerCapture(pointerId)) {
			element.releasePointerCapture(pointerId)
		}
	} catch {}
}
