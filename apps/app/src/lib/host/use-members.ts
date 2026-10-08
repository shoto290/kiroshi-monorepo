import { useEffect } from "react"

import type {
	MembersPanelProps,
	SpaceMember,
} from "@workspace/ui/components/space-settings-dialog/members-panel"

import type { HostedSpace } from "./hosting-controller"
import { isDesktopHost } from "./index"
import { createMembersController } from "./members-controller"

import type { Member } from "../bindings"
import { useController } from "../use-controller"

export type MembersProps = Pick<
	MembersPanelProps,
	| "members"
	| "email"
	| "onEmailChange"
	| "onInvite"
	| "refusal"
	| "removing"
	| "onRemove"
	| "onWithdraw"
	| "onRemoveConfirm"
	| "onRemoveCancel"
>

const toSpaceMember = (member: Member): SpaceMember => ({
	id: member.userId,
	name: member.name ?? undefined,
	email: member.email,
	status: member.status,
})

const hostFirst = (members: Member[]) => [
	...members.filter((member) => member.status === "host"),
	...members.filter((member) => member.status !== "host"),
]

export const useMembers = (
	openSpace: HostedSpace | null,
	isHosted: boolean,
): MembersProps | undefined => {
	const { state, controller } = useController(createMembersController)
	const shownSpace = isDesktopHost() ? openSpace : null
	const watchedSpace = isHosted ? shownSpace : null
	const watchedId = watchedSpace?.id
	const watchedName = watchedSpace?.name

	useEffect(
		() =>
			watchedId === undefined || watchedName === undefined
				? undefined
				: controller.watch({ id: watchedId, name: watchedName }),
		[controller, watchedId, watchedName],
	)

	if (!shownSpace) return undefined
	return {
		members: isHosted ? hostFirst(state.members).map(toSpaceMember) : [],
		email: state.email,
		onEmailChange: controller.setEmail,
		onInvite: controller.invite,
		refusal: state.refusal,
		removing: state.removing ? toSpaceMember(state.removing) : null,
		onRemove: (member) => controller.askRemove(member.id),
		onWithdraw: (member) => controller.withdraw(member.id),
		onRemoveConfirm: controller.confirmRemove,
		onRemoveCancel: controller.cancelRemove,
	}
}
