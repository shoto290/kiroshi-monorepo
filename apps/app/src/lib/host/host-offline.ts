export type HostOffline = {
	kind: "hostOffline"
	detail: string
}

export const hostOfflineOf = (detail: string): HostOffline => ({
	kind: "hostOffline",
	detail,
})

export const isHostOffline = (reason: unknown): reason is HostOffline =>
	typeof reason === "object" &&
	reason !== null &&
	(reason as HostOffline).kind === "hostOffline"
