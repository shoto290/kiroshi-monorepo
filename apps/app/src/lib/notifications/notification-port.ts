import type { NotificationTarget } from "@/lib/bindings"

export type { NotificationTarget } from "@/lib/bindings"

export type NotificationRequest = {
	target: NotificationTarget
	title: string
	body: string
}

export type NotificationActivation = (target: NotificationTarget) => void

type NotificationUnsubscribe = () => void

export type NotificationPort = {
	send: (request: NotificationRequest) => Promise<void>
	onActivate: (
		listener: NotificationActivation,
	) => Promise<NotificationUnsubscribe>
}
