import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type { JoinedSpaceError } from "../bindings"

const NOTICE_KEYS = {
	hostOffline: "hostOffline",
	unavailable: "joinRefused.unavailable",
	storage: "joinRefused.storage",
	unknownJoinedSpace: "joinRefused.unknownJoinedSpace",
	undeliverable: "joinRefused.undeliverable",
	proxyUnavailable: "joinRefused.proxyUnavailable",
} as const satisfies Record<JoinedSpaceError["kind"], string>

export const isJoinedSpaceError = (
	reason: unknown,
): reason is JoinedSpaceError =>
	typeof reason === "object" &&
	reason !== null &&
	"kind" in reason &&
	typeof reason.kind === "string" &&
	Object.hasOwn(NOTICE_KEYS, reason.kind)

export const joinRefusalNoticeOf = ({
	kind,
}: JoinedSpaceError): NoticeMessage => {
	const key = NOTICE_KEYS[kind]
	return {
		title: i18n.t(`chat:screen.notice.${key}.title`),
		description: i18n.t(`chat:screen.notice.${key}.description`),
	}
}
