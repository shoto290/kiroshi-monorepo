import { resolveExecutable } from "./executable"
import { inheritedEnv } from "./session-env"

import type { ProviderAccount, ProviderAuth } from "../provider"
import { describeError } from "../../describe-error"

type AuthStatus = {
	loggedIn?: boolean
	email?: string
	subscriptionType?: string
}

const accountOf = ({
	email,
	subscriptionType,
}: AuthStatus): ProviderAccount | undefined =>
	email || subscriptionType ? { email, plan: subscriptionType } : undefined

export const authenticateClaude = async (): Promise<ProviderAuth> => {
	try {
		const child = Bun.spawn([resolveExecutable(), "auth", "status"], {
			stdout: "pipe",
			stderr: "ignore",
			env: inheritedEnv(),
		})
		const [stdout] = await Promise.all([
			new Response(child.stdout).text(),
			child.exited,
		])
		const status = JSON.parse(stdout.trim()) as AuthStatus
		return {
			authenticated: status.loggedIn === true,
			account: accountOf(status),
		}
	} catch (error) {
		return { authenticated: false, detail: describeError(error) }
	}
}
