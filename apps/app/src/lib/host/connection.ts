export type HostConnection = {
	host: string
	token: string
}

export type HostPage = {
	location: Pick<Location, "hash" | "pathname" | "search">
	history: Pick<History, "replaceState" | "state">
	sessionStorage: Pick<Storage, "getItem" | "setItem">
}

const HOST_KEY = "kiroshi.host"

const TOKEN_KEY = "kiroshi.host-token"

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

const originOf = (host: string): string | null => {
	if (!URL.canParse(host)) {
		return null
	}
	const url = new URL(host)
	return ALLOWED_PROTOCOLS.has(url.protocol) ? url.origin : null
}

const connectionOf = (
	host: string | null,
	token: string | null,
): HostConnection | null => {
	const origin = host ? originOf(host.trim()) : null
	const trimmedToken = token?.trim()
	return origin && trimmedToken ? { host: origin, token: trimmedToken } : null
}

const fragmentConnection = (hash: string): HostConnection | null => {
	const fragment = new URLSearchParams(hash.replace(/^#/, ""))
	return connectionOf(fragment.get("host"), fragment.get("token"))
}

const storedConnection = (
	storage: HostPage["sessionStorage"],
): HostConnection | null =>
	connectionOf(storage.getItem(HOST_KEY), storage.getItem(TOKEN_KEY))

const clearFragment = ({ location, history }: HostPage) => {
	history.replaceState(history.state, "", location.pathname + location.search)
}

export const adoptHostConnection = (page: HostPage): HostConnection | null => {
	const adopted = fragmentConnection(page.location.hash)
	if (!adopted) {
		return storedConnection(page.sessionStorage)
	}
	page.sessionStorage.setItem(HOST_KEY, adopted.host)
	page.sessionStorage.setItem(TOKEN_KEY, adopted.token)
	clearFragment(page)
	return adopted
}
