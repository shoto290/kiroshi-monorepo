import { useEffect } from "react"

import type {
	AccountPanelProps,
	AccountState as AccountPanelState,
} from "@workspace/ui/components/user-settings-dialog/account-panel"

import { createAccountController } from "./account-controller"

import type { AccountState } from "../bindings"
import { useController } from "../use-controller"

const localPartOf = (email: string) => {
	const [localPart = email] = email.split("@")
	return localPart
}

const toPanelState = (
	state: AccountState,
	displayName: string,
): AccountPanelState => {
	if (state.kind === "signedIn") {
		return {
			status: "signedIn",
			name: displayName || localPartOf(state.email),
			email: state.email,
		}
	}
	if (state.kind === "waiting") {
		return { status: "waiting" }
	}
	return { status: "signedOut" }
}

export const useAccount = (displayName: string): AccountPanelProps => {
	const { state, controller } = useController(createAccountController)

	useEffect(() => controller.watch(), [controller])

	return {
		account: toPanelState(state, displayName),
		onSignIn: controller.signIn,
		onCancel: controller.cancel,
		onSignOut: controller.signOut,
	}
}
