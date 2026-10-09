import { useMemo } from "react"

import type { WorkspaceCore } from "./use-workspace-core"

import { storedOwnAccounts } from "../account/own-accounts"
import { signedInAccountIdOf } from "../account/use-account"
import type { SpaceHost, ThreadAuthorship } from "../chat/thread-authorship"
import { openJoinedSpaceOf } from "../spaces/joined-spaces-controller"

export const useThreadAuthorship = ({
	account,
	joinedSpaces,
	spaces,
}: WorkspaceCore): ThreadAuthorship => {
	const accountId = signedInAccountIdOf(account.state)
	const { joinedSpaces: joined, openId } = joinedSpaces.state
	const { selectedSpaceId } = spaces.state
	const { hostEmailOf } = joinedSpaces.controller

	return useMemo(() => {
		const open = openJoinedSpaceOf(joined, openId, selectedSpaceId)
		const host: SpaceHost = open
			? { kind: "joined", name: hostEmailOf(open.id) }
			: { kind: "hosted", ownAccountIds: storedOwnAccounts.list() }
		return { accountId, host }
	}, [accountId, joined, openId, selectedSpaceId, hostEmailOf])
}
