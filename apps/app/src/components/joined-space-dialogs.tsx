import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { JoinSpaceDialog } from "@workspace/ui/components/join-space-dialog"
import { i18n } from "@workspace/ui/lib/i18n"

import type { JoinedSpaces } from "@/lib/spaces/use-joined-spaces"

type JoinedSpaceDialogsProps = {
	joinedSpaces: JoinedSpaces
}

export const JoinedSpaceDialogs = ({
	joinedSpaces,
}: JoinedSpaceDialogsProps) => {
	const { state, controller } = joinedSpaces
	const leaving = state.joinedSpaces.find(
		(joined) => joined.id === state.leavingId,
	)

	return (
		<>
			<JoinSpaceDialog
				link={state.joinLink}
				onJoin={() => {
					void controller.join()
				}}
				onLinkChange={controller.changeJoinLink}
				onOpenChange={controller.setJoinOpen}
				open={state.isJoinOpen}
				state={state.joinState}
			/>
			<ConfirmDialog
				confirmLabel={i18n.t("common:spaces.leave.action")}
				description={i18n.t("common:spaces.leave.description")}
				onConfirm={() => (leaving ? controller.leave(leaving.id) : undefined)}
				onOpenChange={controller.setLeaveOpen}
				open={state.isLeaveOpen}
				title={i18n.t("common:spaces.leave.title", {
					name: leaving?.name ?? "",
				})}
			/>
		</>
	)
}
