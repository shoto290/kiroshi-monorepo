import {
	auth,
	discoverOAuthServerInfo,
	type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js"
import type {
	AuthorizationServerMetadata,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js"

import { describeError } from "./describe-error"

const LOOPBACK = "127.0.0.1"
const REDIRECT_PATH = "/oauth/callback"
const CLIENT_NAME = "Kiroshi"
const REQUEST_TIMEOUT_MS = 30_000
const GRANTED = "Authorization granted. You can close this tab."
const DENIED = "Authorization was refused. You can close this tab."
const REFUSED = "This is not the redirect this flow is waiting for."
const NO_REVOCATION =
	"the authorization server advertises no revocation endpoint"

export const OAUTH_STARTED = "oauth_started"

export const FLOW_TIMEOUT_MS = 300_000

export type OauthFailureKind =
	| "busy"
	| "cancelled"
	| "timedOut"
	| "denied"
	| "failed"

export type OauthFailure = {
	kind: OauthFailureKind
	detail?: string
}

export type OauthCredentials = {
	accessToken: string
	refreshToken?: string
	expiresAt?: number
	clientId: string
	clientSecret?: string
}

export type OauthAnswer =
	| { credentials: OauthCredentials }
	| { error: OauthFailure }

export type RevocationAnswer = {
	revoked: boolean
	detail?: string
}

export type AuthorizeRequest = {
	url?: string
}

export type RevokeRequest = {
	url?: string
	token?: string
	clientId?: string
	clientSecret?: string
}

type Emit = (frame: Record<string, unknown>) => void

type Redirect = { code: string } | { failure: OauthFailure }

type Settle = (redirect: Redirect) => void

type Held = {
	client?: OAuthClientInformationFull
	codeVerifier?: string
	tokens?: OAuthTokens
}

let running: Settle | undefined

const timedFetch: FetchLike = (input, init) =>
	fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

const refused = () => new Response(REFUSED, { status: 400 })

const answerRedirect = (
	request: Request,
	state: string,
	settle: Settle,
): Response => {
	const asked = new URL(request.url)
	if (asked.pathname !== REDIRECT_PATH) {
		return refused()
	}
	if (asked.searchParams.get("state") !== state) {
		return refused()
	}
	const denied = asked.searchParams.get("error")
	if (denied) {
		settle({ failure: { kind: "denied", detail: denied } })
		return new Response(DENIED)
	}
	const code = asked.searchParams.get("code")
	if (!code) {
		return refused()
	}
	settle({ code })
	return new Response(GRANTED)
}

const clientMetadata = (redirectUrl: string): OAuthClientMetadata => ({
	client_name: CLIENT_NAME,
	redirect_uris: [redirectUrl],
	grant_types: ["authorization_code", "refresh_token"],
	response_types: ["code"],
	token_endpoint_auth_method: "client_secret_post",
})

const clientProvider = (
	redirectUrl: string,
	state: string,
	held: Held,
	emit: Emit,
): OAuthClientProvider => ({
	get redirectUrl() {
		return redirectUrl
	},
	get clientMetadata() {
		return clientMetadata(redirectUrl)
	},
	state: () => state,
	clientInformation: () => held.client,
	saveClientInformation: (information) => {
		held.client = information as OAuthClientInformationFull
	},
	tokens: () => held.tokens,
	saveTokens: (tokens) => {
		held.tokens = tokens
	},
	saveCodeVerifier: (codeVerifier) => {
		held.codeVerifier = codeVerifier
	},
	codeVerifier: () => held.codeVerifier ?? "",
	redirectToAuthorization: (authorizationUrl) => {
		emit({ type: OAUTH_STARTED, url: authorizationUrl.toString() })
	},
})

const credentialsOf = (
	tokens: OAuthTokens,
	client: OAuthClientInformationFull,
): OauthCredentials => ({
	accessToken: tokens.access_token,
	refreshToken: tokens.refresh_token,
	expiresAt:
		tokens.expires_in === undefined
			? undefined
			: Date.now() + tokens.expires_in * 1000,
	clientId: client.client_id,
	clientSecret: client.client_secret,
})

const exchanged = async (
	serverUrl: string,
	redirectUrl: string,
	state: string,
	arrival: Promise<Redirect>,
	emit: Emit,
): Promise<OauthAnswer> => {
	const held: Held = {}
	const provider = clientProvider(redirectUrl, state, held, emit)
	const opened = await auth(provider, { serverUrl, fetchFn: timedFetch })
	if (opened !== "REDIRECT") {
		return {
			error: {
				kind: "failed",
				detail: `the authorization flow answered ${opened}`,
			},
		}
	}
	const redirect = await arrival
	if ("failure" in redirect) {
		return { error: redirect.failure }
	}
	await auth(provider, {
		serverUrl,
		authorizationCode: redirect.code,
		fetchFn: timedFetch,
	})
	const { tokens, client } = held
	if (!tokens || !client) {
		return {
			error: { kind: "failed", detail: "the token exchange returned nothing" },
		}
	}
	return { credentials: credentialsOf(tokens, client) }
}

export const authorizeMcpServer = async (
	{ url }: AuthorizeRequest,
	emit: Emit,
	timeoutMs = FLOW_TIMEOUT_MS,
): Promise<OauthAnswer> => {
	if (!url) {
		return { error: { kind: "failed", detail: "no server url was named" } }
	}
	if (running) {
		return {
			error: {
				kind: "busy",
				detail: "another authorization is already running",
			},
		}
	}
	const state = crypto.randomUUID()
	let settle: Settle = () => undefined
	const arrival = new Promise<Redirect>((resolve) => {
		settle = resolve
	})
	const listener = Bun.serve({
		hostname: LOOPBACK,
		port: 0,
		fetch: (request) => answerRedirect(request, state, settle),
	})
	const expiry = setTimeout(
		() => settle({ failure: { kind: "timedOut" } }),
		timeoutMs,
	)
	running = settle
	try {
		return await exchanged(
			url,
			`http://${LOOPBACK}:${listener.port}${REDIRECT_PATH}`,
			state,
			arrival,
			emit,
		)
	} catch (error) {
		return { error: { kind: "failed", detail: describeError(error) } }
	} finally {
		clearTimeout(expiry)
		running = undefined
		await listener.stop()
	}
}

export const cancelMcpAuthorization = () => {
	running?.({ failure: { kind: "cancelled" } })
}

const revocationBody = ({ token, clientId, clientSecret }: RevokeRequest) => {
	const body = new URLSearchParams({
		token: token ?? "",
		token_type_hint: "access_token",
	})
	if (clientId) {
		body.set("client_id", clientId)
	}
	if (clientSecret) {
		body.set("client_secret", clientSecret)
	}
	return body
}

const revocationEndpoint = (metadata?: AuthorizationServerMetadata) =>
	metadata && "revocation_endpoint" in metadata
		? metadata.revocation_endpoint
		: undefined

const posted = async (
	endpoint: string,
	request: RevokeRequest,
): Promise<RevocationAnswer> => {
	const answered = await timedFetch(endpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: revocationBody(request),
	})
	if (!answered.ok) {
		return {
			revoked: false,
			detail: `the revocation endpoint answered ${answered.status}`,
		}
	}
	return { revoked: true }
}

export const revokeMcpToken = async (
	request: RevokeRequest,
): Promise<RevocationAnswer> => {
	const { url, token } = request
	if (!url || !token) {
		return { revoked: false, detail: "no server url or no token was named" }
	}
	try {
		const discovered = await discoverOAuthServerInfo(url, {
			fetchFn: timedFetch,
		})
		const endpoint = revocationEndpoint(discovered.authorizationServerMetadata)
		if (!endpoint) {
			return { revoked: false, detail: NO_REVOCATION }
		}
		return await posted(endpoint, request)
	} catch (error) {
		return { revoked: false, detail: describeError(error) }
	}
}
