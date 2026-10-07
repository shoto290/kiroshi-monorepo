import { useEffect } from "react"

import type {
	AccountPanelProps,
	AccountState as AccountPanelState,
} from "@workspace/ui/components/user-settings-dialog/account-panel"

import { createAccountController } from "./account-controller"

import type { AccountState } from "../bindings"
import { useController } from "../use-controller"

const nameOf = (email: string) => {
	const [name = email] = email.split("@")
	return name
}

const toPanelState = (state: AccountState): AccountPanelState => {
	if (state.kind === "signedIn") {
		return { status: "signedIn", name: nameOf(state.email), email: state.email }
	}
	if (state.kind === "waiting") {
		return { status: "waiting" }
	}
	return { status: "signedOut" }
}

export const useAccount = (): AccountPanelProps => {
	const { state, controller } = useController(createAccountController)

	useEffect(() => controller.watch(), [controller])

	return {
		account: toPanelState(state),
		onSignIn: controller.signIn,
		onCancel: controller.cancel,
		onSignOut: controller.signOut,
	}
}
