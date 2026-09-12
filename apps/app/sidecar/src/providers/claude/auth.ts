import { resolveExecutable } from "./executable"
import { sessionEnv } from "./session-env"

import type { ProviderAccount, ProviderAuth } from "../provider"
import { describeError } from "../../describe-error"

type AuthStatus = {
	loggedIn?: boolean
	email?: string
	subscriptionType?: string
	authMethod?: unknown
}

const accountOf = ({
	email,
	subscriptionType,
}: AuthStatus): ProviderAccount | undefined =>
	email || subscriptionType ? { email, plan: subscriptionType } : undefined

const namedMethod = ({ authMethod }: AuthStatus) =>
	typeof authMethod === "string" ? { authMethod } : {}

export const authenticateClaude = async (
	connection: Record<string, string> = {},
): Promise<ProviderAuth> => {
	try {
		const child = Bun.spawn([resolveExecutable(), "auth", "status"], {
			env: sessionEnv(connection),
			stdout: "pipe",
			stderr: "ignore",
		})
		const [stdout] = await Promise.all([
			new Response(child.stdout).text(),
			child.exited,
		])
		const status = JSON.parse(stdout.trim()) as AuthStatus
		return {
			authenticated: status.loggedIn === true,
			account: accountOf(status),
			...namedMethod(status),
		}
	} catch (error) {
		return { authenticated: false, detail: describeError(error) }
	}
}
