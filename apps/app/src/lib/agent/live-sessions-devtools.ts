import type { LiveSession } from "./contract"
import { liveSessions } from "./transport"

declare global {
	interface Window {
		kiroshi?: { liveSessions: () => Promise<LiveSession[]> }
	}
}

const bindLiveSessions = () => {
	window.kiroshi = { liveSessions }
}

export const exposeLiveSessions = import.meta.env.DEV
	? bindLiveSessions
	: () => {}
