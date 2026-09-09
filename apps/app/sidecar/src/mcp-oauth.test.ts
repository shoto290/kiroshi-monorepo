import { describe, expect, it } from "bun:test"

import {
	authorizeMcpServer,
	cancelMcpAuthorization,
	OAUTH_STARTED,
	revokeMcpToken,
} from "./mcp-oauth"

const CLIENT_ID = "client-of-this-flow"
const CLIENT_SECRET = "secret-of-this-flow"
const ACCESS_TOKEN = "granted-access-token"
const REFRESH_TOKEN = "granted-refresh-token"
const EXPIRES_IN = 3600
const CODE = "the-authorization-code"

type Registration = {
	redirectUris: string[]
	tokenRequests: URLSearchParams[]
	revocations: URLSearchParams[]
}

type Authority = {
	url: string
	seen: Registration
	stop: () => Promise<void>
}

const anAuthorizationServer = (
	{ revocable }: { revocable: boolean } = { revocable: true },
): Authority => {
	const seen: Registration = {
		redirectUris: [],
		tokenRequests: [],
		revocations: [],
	}
	const served = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: async (request): Promise<Response> => {
			const asked = new URL(request.url)
			if (asked.pathname === "/.well-known/oauth-authorization-server") {
				return Response.json({
					issuer: asked.origin,
					authorization_endpoint: `${asked.origin}/authorize`,
					token_endpoint: `${asked.origin}/token`,
					registration_endpoint: `${asked.origin}/register`,
					response_types_supported: ["code"],
					code_challenge_methods_supported: ["S256"],
					...(revocable
						? { revocation_endpoint: `${asked.origin}/revoke` }
						: {}),
				})
			}
			if (asked.pathname === "/register") {
				const body = (await request.json()) as { redirect_uris: string[] }
				seen.redirectUris.push(...body.redirect_uris)
				return Response.json(
					{
						client_id: CLIENT_ID,
						client_secret: CLIENT_SECRET,
						redirect_uris: body.redirect_uris,
					},
					{ status: 201 },
				)
			}
			if (asked.pathname === "/token") {
				seen.tokenRequests.push(new URLSearchParams(await request.text()))
				return Response.json({
					access_token: ACCESS_TOKEN,
					refresh_token: REFRESH_TOKEN,
					token_type: "Bearer",
					expires_in: EXPIRES_IN,
				})
			}
			if (asked.pathname === "/revoke") {
				seen.revocations.push(new URLSearchParams(await request.text()))
				return new Response(null, { status: 200 })
			}
			return new Response(null, { status: 404 })
		},
	})
	return {
		url: `http://127.0.0.1:${served.port}`,
		seen,
		stop: async () => {
			await served.stop(true)
		},
	}
}

const frames: Record<string, unknown>[] = []

const collect = (frame: Record<string, unknown>) => {
	frames.push(frame)
}

const startedUrl = () => {
	const started = frames.filter((frame) => frame.type === OAUTH_STARTED)
	expect(started).toHaveLength(1)
	return new URL(String(started[0]?.url))
}

const waitForRegistration = async (seen: Registration) => {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const [redirect] = seen.redirectUris
		if (redirect) {
			return redirect
		}
		await Bun.sleep(10)
	}
	throw new Error("the flow never registered a client")
}

describe("mcp oauth", () => {
	it("drives discovery, registration, the redirect and the exchange", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect)
			const redirect = await waitForRegistration(authority.seen)
			const asked = startedUrl()
			const landing = new URL(redirect)
			landing.searchParams.set("code", CODE)
			landing.searchParams.set("state", String(asked.searchParams.get("state")))
			const answered = await fetch(landing)
			const settled = await flow

			expect(answered.status).toBe(200)
			expect(landing.hostname).toBe("127.0.0.1")
			expect(asked.searchParams.get("code_challenge_method")).toBe("S256")
			expect(asked.searchParams.get("client_id")).toBe(CLIENT_ID)
			expect(authority.seen.tokenRequests[0]?.get("code")).toBe(CODE)
			expect(authority.seen.tokenRequests[0]?.get("code_verifier")).toBeTruthy()
			expect(authority.seen.tokenRequests[0]?.get("redirect_uri")).toBe(
				redirect,
			)
			expect(settled).toEqual({
				credentials: {
					accessToken: ACCESS_TOKEN,
					refreshToken: REFRESH_TOKEN,
					expiresAt: expect.any(Number),
					clientId: CLIENT_ID,
					clientSecret: CLIENT_SECRET,
				},
			})
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("refuses a redirect on another path and keeps the flow waiting", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect)
			const redirect = new URL(await waitForRegistration(authority.seen))
			const elsewhere = new URL(redirect)
			elsewhere.pathname = "/elsewhere"
			const answered = await fetch(elsewhere)
			cancelMcpAuthorization()

			expect(answered.status).toBe(400)
			expect(await flow).toEqual({ error: { kind: "cancelled" } })
			expect(authority.seen.tokenRequests).toHaveLength(0)
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("refuses a redirect carrying another state and keeps the flow waiting", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect)
			const landing = new URL(await waitForRegistration(authority.seen))
			landing.searchParams.set("code", CODE)
			landing.searchParams.set("state", "not-the-state-of-this-flow")
			const answered = await fetch(landing)
			cancelMcpAuthorization()

			expect(answered.status).toBe(400)
			expect(await flow).toEqual({ error: { kind: "cancelled" } })
			expect(authority.seen.tokenRequests).toHaveLength(0)
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("settles as failed when the redirect carries an error", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect)
			const redirect = await waitForRegistration(authority.seen)
			const landing = new URL(redirect)
			landing.searchParams.set("error", "access_denied")
			landing.searchParams.set(
				"state",
				String(startedUrl().searchParams.get("state")),
			)
			await fetch(landing)

			expect(await flow).toEqual({
				error: { kind: "denied", detail: "access_denied" },
			})
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("settles as timed out and frees the port it bound", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect, 50)
			const redirect = await waitForRegistration(authority.seen)

			expect(await flow).toEqual({ error: { kind: "timedOut" } })
			await expect(fetch(redirect)).rejects.toThrow()
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("refuses a second flow while one is running", async () => {
		frames.length = 0
		const authority = anAuthorizationServer()
		try {
			const flow = authorizeMcpServer({ url: authority.url }, collect)
			await waitForRegistration(authority.seen)
			const second = await authorizeMcpServer({ url: authority.url }, collect)
			cancelMcpAuthorization()
			await flow

			expect(second).toMatchObject({ error: { kind: "busy" } })
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("posts the token to the revocation endpoint the metadata advertises", async () => {
		const authority = anAuthorizationServer()
		try {
			const answered = await revokeMcpToken({
				url: authority.url,
				token: ACCESS_TOKEN,
				clientId: CLIENT_ID,
				clientSecret: CLIENT_SECRET,
			})

			expect(answered).toEqual({ revoked: true })
			expect(authority.seen.revocations[0]?.get("token")).toBe(ACCESS_TOKEN)
			expect(authority.seen.revocations[0]?.get("client_id")).toBe(CLIENT_ID)
		} finally {
			await authority.stop()
		}
	}, 20_000)

	it("answers that no revocation endpoint was advertised", async () => {
		const authority = anAuthorizationServer({ revocable: false })
		try {
			const answered = await revokeMcpToken({
				url: authority.url,
				token: ACCESS_TOKEN,
			})

			expect(answered.revoked).toBe(false)
			expect(answered.detail).toContain("no revocation endpoint")
			expect(authority.seen.revocations).toHaveLength(0)
		} finally {
			await authority.stop()
		}
	}, 20_000)
})
