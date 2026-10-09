import { useMemo } from "react"

import type { WorkspaceCore } from "./use-workspace-core"

import { signedInAccountIdOf } from "../account/use-account"
import {
	HOSTED_SIGNED_OUT,
	type SpaceHost,
	type ThreadAuthorship,
} from "../chat/thread-authorship"
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
			: HOSTED_SIGNED_OUT.host
		return { accountId, host }
	}, [accountId, joined, openId, selectedSpaceId, hostEmailOf])
}
