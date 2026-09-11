import {
	auth,
	discoverOAuthServerInfo,
	type OAuthClientProvider,
	refreshAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js"
import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js"
import type {
	AuthorizationServerMetadata,
	OAuthClientInformation,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js"

import { describeError } from "./describe-error"

const LOOPBACK = "127.0.0.1"
const LOOPBACK_HOSTS = new Set([LOOPBACK, "localhost"])
const PORT_SUFFIX = /:\d+$/
const OPENABLE_SCHEMES = new Set(["http:", "https:"])
const REDIRECT_PATH = "/oauth/callback"
const CLIENT_NAME = "Kiroshi"
const REQUEST_TIMEOUT_MS = 30_000
export const REFRESH_TIMEOUT_MS = 10_000
const GRANTED = "Authorization granted. You can close this tab."
const DENIED = "Authorization was refused. You can close this tab."
const REFUSED = "This is not the redirect this flow is waiting for."
const NO_REVOCATION =
	"the authorization server advertises no revocation endpoint"

export const OAUTH_STARTED = "oauth_started"

const FLOW_TIMEOUT_MS = 300_000

export type OauthFailureKind =
	| "busy"
	| "cancelled"
	| "timedOut"
	| "denied"
	| "rejected"
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
	refreshToken?: string
	clientId?: string
	clientSecret?: string
}

export type RefreshRequest = {
	url?: string
	refreshToken?: string
	clientId?: string
	clientSecret?: string
}

type Emit = (frame: Record<string, unknown>) => void

type Redirect = { code: string } | { failure: OauthFailure }

type Settle = (redirect: Redirect) => void

type Attempt = {
	serverUrl: string
	redirectUrl: string
	state: string
	arrival: Promise<Redirect>
	emit: Emit
}

type Held = {
	client?: OAuthClientInformationFull
	codeVerifier?: string
	tokens?: OAuthTokens
}

let running: Settle | undefined

const timedFetch: FetchLike = (input, init) =>
	fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

const fetchWithin =
	(deadline: AbortSignal): FetchLike =>
	(input, init) =>
		fetch(input, { ...init, signal: deadline })

const refused = () => new Response(REFUSED, { status: 400 })

const isLoopback = (host: string | null) =>
	host !== null && LOOPBACK_HOSTS.has(host.replace(PORT_SUFFIX, ""))

const settleOnceAnswered = (settle: Settle, redirect: Redirect) => {
	setTimeout(() => settle(redirect), 0)
}

const answerRedirect = (
	request: Request,
	state: string,
	settle: Settle,
): Response => {
	if (!isLoopback(request.headers.get("host"))) {
		return refused()
	}
	const asked = new URL(request.url)
	if (asked.pathname !== REDIRECT_PATH) {
		return refused()
	}
	if (asked.searchParams.get("state") !== state) {
		return refused()
	}
	const denied = asked.searchParams.get("error")
	if (denied) {
		settleOnceAnswered(settle, { failure: { kind: "denied", detail: denied } })
		return new Response(DENIED)
	}
	const code = asked.searchParams.get("code")
	if (!code) {
		return refused()
	}
	settleOnceAnswered(settle, { code })
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
	{ redirectUrl, state, emit }: Attempt,
	held: Held,
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
		if (!OPENABLE_SCHEMES.has(authorizationUrl.protocol)) {
			throw new Error(
				`the authorization server named the refused scheme ${authorizationUrl.protocol}`,
			)
		}
		emit({ type: OAUTH_STARTED, url: authorizationUrl.toString() })
	},
})

const credentialsOf = (
	tokens: OAuthTokens,
	client: OAuthClientInformation,
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

const exchanged = async (attempt: Attempt): Promise<OauthAnswer> => {
	const { serverUrl, arrival } = attempt
	const held: Held = {}
	const provider = clientProvider(attempt, held)
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
		return await exchanged({
			serverUrl: url,
			redirectUrl: `http://${LOOPBACK}:${listener.port}${REDIRECT_PATH}`,
			state,
			arrival,
			emit,
		})
	} catch (error) {
		return { error: { kind: "failed", detail: describeError(error) } }
	} finally {
		clearTimeout(expiry)
		running = undefined
		await listener.stop(true)
	}
}

export const cancelMcpAuthorization = () => {
	running?.({ failure: { kind: "cancelled" } })
}

type Revocable = [token: string, hint: string]

const revocables = ({ token, refreshToken }: RevokeRequest): Revocable[] => {
	const posted: Revocable[] = []
	if (token) {
		posted.push([token, "access_token"])
	}
	if (refreshToken) {
		posted.push([refreshToken, "refresh_token"])
	}
	return posted
}

const revocationBody = (
	{ clientId, clientSecret }: RevokeRequest,
	[token, hint]: Revocable,
) => {
	const body = new URLSearchParams({ token, token_type_hint: hint })
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
	for (const revocable of revocables(request)) {
		const answered = await timedFetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: revocationBody(request, revocable),
		})
		if (!answered.ok) {
			return {
				revoked: false,
				detail: `the revocation endpoint answered ${answered.status}`,
			}
		}
	}
	return { revoked: true }
}

const REFUSED_GRANT_CODES = new Set([
	"invalid_grant",
	"invalid_client",
	"unauthorized_client",
])

const oauthDetail = (error: OAuthError) =>
	[error.errorCode, error.message].filter(Boolean).join(": ")

const refreshFailure = (error: unknown): OauthFailure => {
	if (!(error instanceof OAuthError)) {
		return { kind: "failed", detail: describeError(error) }
	}
	return {
		kind: REFUSED_GRANT_CODES.has(error.errorCode) ? "rejected" : "failed",
		detail: oauthDetail(error),
	}
}

export const refreshMcpToken = async (
	{ url, refreshToken, clientId, clientSecret }: RefreshRequest,
	timeoutMs = REFRESH_TIMEOUT_MS,
): Promise<OauthAnswer> => {
	if (!url || !refreshToken || !clientId) {
		return {
			error: {
				kind: "failed",
				detail: "no server url, refresh token or client id was named",
			},
		}
	}
	const fetchFn = fetchWithin(AbortSignal.timeout(timeoutMs))
	try {
		const discovered = await discoverOAuthServerInfo(url, { fetchFn })
		const client = { client_id: clientId, client_secret: clientSecret }
		const tokens = await refreshAuthorization(
			discovered.authorizationServerUrl,
			{
				metadata: discovered.authorizationServerMetadata,
				clientInformation: client,
				refreshToken,
				fetchFn,
			},
		)
		return { credentials: credentialsOf(tokens, client) }
	} catch (error) {
		return { error: refreshFailure(error) }
	}
}

export const revokeMcpToken = async (
	request: RevokeRequest,
): Promise<RevocationAnswer> => {
	const { url } = request
	if (!url || revocables(request).length === 0) {
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
