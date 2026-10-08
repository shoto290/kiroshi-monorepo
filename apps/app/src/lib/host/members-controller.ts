import {
	type NoticeMessage,
	raiseFailureNotice,
	raiseTransientNotice,
} from "@workspace/ui/components/notice-surface"
import type { InviteRefusal } from "@workspace/ui/components/space-settings-dialog/members-panel"
import { i18n } from "@workspace/ui/lib/i18n"

import type { HostedSpace } from "./hosting-controller"
import { listen } from "./index"

import {
	commands,
	HOSTING_MEMBERS_CHANGED_EVENT,
	type Member,
	type MembersChanged,
	type MembersError,
} from "../bindings"
import { createStore } from "../store"

type MembersAnswer<Data> =
	| { status: "ok"; data: Data }
	| { status: "error"; error: MembersError }

export type MembersTransport = {
	list: (spaceId: string) => Promise<MembersAnswer<Member[]>>
	invite: (spaceId: string, email: string) => Promise<MembersAnswer<Member>>
	withdraw: (
		spaceId: string,
		userId: string,
	) => Promise<MembersAnswer<Member[]>>
	remove: (spaceId: string, userId: string) => Promise<MembersAnswer<Member[]>>
	onChanged: (
		listener: (changed: MembersChanged) => void,
	) => Promise<() => void>
}

type MembersControllerState = {
	members: Member[]
	email: string
	refusal: InviteRefusal | undefined
	removing: Member | null
}

type MembersController = {
	getState: () => MembersControllerState
	subscribe: (listener: () => void) => () => void
	watch: (space: HostedSpace) => () => void
	setEmail: (email: string) => void
	invite: (email: string) => void
	withdraw: (userId: string) => void
	askRemove: (userId: string) => void
	confirmRemove: () => void
	cancelRemove: () => void
}

type MembersControllerOptions = {
	transport?: MembersTransport
	reportFailure?: (message: NoticeMessage) => void
	reportSuccess?: (message: NoticeMessage) => void
}

const membersTransport: MembersTransport = {
	list: commands.hostingMembers,
	invite: commands.hostingInviteMember,
	withdraw: commands.hostingWithdrawInvitation,
	remove: commands.hostingRemoveMember,
	onChanged: (listener) =>
		listen<MembersChanged>(HOSTING_MEMBERS_CHANGED_EVENT, (event) =>
			listener(event.payload),
		),
}

const INVITE_REFUSALS: Partial<Record<MembersError["kind"], InviteRefusal>> = {
	alreadyInvited: "invited",
	ownAccount: "self",
	notAnEmail: "malformed",
}

const EMPTY_STATE: MembersControllerState = {
	members: [],
	email: "",
	refusal: undefined,
	removing: null,
}

const nothingChanged = () => i18n.t("settings:space.transfer.reason.generic")

const readFailure = (): NoticeMessage => ({
	title: i18n.t("settings:rail.members"),
	description: nothingChanged(),
})

const inviteFailure = (): NoticeMessage => ({
	title: i18n.t("settings:space.members.invite.label"),
	description: nothingChanged(),
})

const removeFailure = (member: Member): NoticeMessage => ({
	title: i18n.t("settings:space.members.removeLabel", {
		name: member.name ?? member.email,
	}),
	description: nothingChanged(),
})

const withdrawnNotice = (member: Member): NoticeMessage => ({
	title: i18n.t("settings:space.members.withdrawn", { email: member.email }),
})

const withMember = (members: Member[], member: Member) => [
	...members.filter((held) => held.userId !== member.userId),
	member,
]

type Session = {
	space: HostedSpace
}

export const createMembersController = ({
	transport = membersTransport,
	reportFailure = raiseFailureNotice,
	reportSuccess = raiseTransientNotice,
}: MembersControllerOptions = {}): MembersController => {
	const stateStore = createStore<MembersControllerState>(EMPTY_STATE)
	let current: Session | null = null
	let lastWatchedId: string | null = null

	const patch = (next: Partial<MembersControllerState>) =>
		stateStore.setState({ ...stateStore.getState(), ...next })

	const memberOf = (userId: string) =>
		stateStore.getState().members.find((member) => member.userId === userId)

	const run = <Data>(
		call: (spaceId: string) => Promise<MembersAnswer<Data>>,
		failure: NoticeMessage,
		settle: (data: Data) => void,
		refuse: (error: MembersError) => boolean = () => false,
	) => {
		const session = current
		if (!session) return
		void call(session.space.id).then(
			(answer) => {
				if (current !== session) return
				if (answer.status === "ok") {
					settle(answer.data)
				} else if (!refuse(answer.error)) {
					reportFailure(failure)
				}
			},
			() => {
				if (current === session) reportFailure(failure)
			},
		)
	}

	const watch = (space: HostedSpace) => {
		const session: Session = { space }
		current = session
		if (lastWatchedId !== space.id) {
			stateStore.setState(EMPTY_STATE)
		}
		lastWatchedId = space.id
		run(transport.list, readFailure(), (members) => patch({ members }))
		const detach = transport
			.onChanged((changed) => {
				if (current === session && changed.spaceId === space.id) {
					patch({ members: changed.members })
				}
			})
			.catch(() => reportFailure(readFailure()))
		return () => {
			if (current === session) current = null
			void detach.then((unlisten) => unlisten?.())
		}
	}

	const refuseInvite = (error: MembersError) => {
		const refusal = INVITE_REFUSALS[error.kind]
		if (refusal) patch({ refusal })
		return refusal !== undefined
	}

	const invite = (email: string) =>
		run(
			(spaceId) => transport.invite(spaceId, email),
			inviteFailure(),
			(member) =>
				patch({
					members: withMember(stateStore.getState().members, member),
					email: "",
					refusal: undefined,
				}),
			refuseInvite,
		)

	const withdraw = (userId: string) => {
		const member = memberOf(userId)
		if (!member) return
		run(
			(spaceId) => transport.withdraw(spaceId, userId),
			removeFailure(member),
			(members) => {
				patch({ members })
				reportSuccess(withdrawnNotice(member))
			},
		)
	}

	const askRemove = (userId: string) => {
		const member = memberOf(userId)
		if (member) patch({ removing: member })
	}

	const confirmRemove = () => {
		const member = stateStore.getState().removing
		if (!member) return
		patch({ removing: null })
		run(
			(spaceId) => transport.remove(spaceId, member.userId),
			removeFailure(member),
			(members) => patch({ members }),
		)
	}

	return {
		getState: stateStore.getState,
		subscribe: stateStore.subscribe,
		watch,
		setEmail: (email) => patch({ email, refusal: undefined }),
		invite,
		withdraw,
		askRemove,
		confirmRemove,
		cancelRemove: () => patch({ removing: null }),
	}
}
