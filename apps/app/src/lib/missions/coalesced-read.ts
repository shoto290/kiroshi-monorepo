const MISSION_READ_INTERVAL_MS = 1000

type CoalescedRead = {
	request: () => void
	cancel: () => void
}

export const coalescedRead = (read: () => void): CoalescedRead => {
	let lastReadAt = Number.NEGATIVE_INFINITY
	let pending: ReturnType<typeof setTimeout> | undefined
	let isCancelled = false

	const readNow = () => {
		pending = undefined
		lastReadAt = Date.now()
		read()
	}

	return {
		request: () => {
			if (isCancelled || pending !== undefined) return
			const wait = lastReadAt + MISSION_READ_INTERVAL_MS - Date.now()
			if (wait <= 0) {
				readNow()
				return
			}
			pending = setTimeout(readNow, wait)
		},
		cancel: () => {
			isCancelled = true
			clearTimeout(pending)
		},
	}
}
