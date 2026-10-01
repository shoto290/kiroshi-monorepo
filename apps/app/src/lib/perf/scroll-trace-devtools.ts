import { installScrollTrace } from "@workspace/ui/lib/scroll-trace"

const SCROLL_TRACE_FLAG = "kiroshi:scroll-trace"

const installWhenFlagged = () => {
	if (window.localStorage.getItem(SCROLL_TRACE_FLAG) === "on") {
		installScrollTrace()
	}
}

export const exposeScrollTrace = import.meta.env.DEV
	? installWhenFlagged
	: () => {}
