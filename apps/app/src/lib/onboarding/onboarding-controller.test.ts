import { beforeEach, describe, expect, it } from "vitest"

import {
	createFakeOnboardingPort,
	type FakeOnboardingPort,
} from "./fake-onboarding-port"
import {
	createOnboardingController,
	type OnboardingController,
} from "./onboarding-controller"
import { onboardingSummonsFor } from "./onboarding-summons"

import type { CheckReport } from "../agent/contract"

const SIGN_IN_URL = "https://claude.ai/oauth/authorize?code=true"

const EMAIL = "reader@example.com"

const API_KEY = "sk-ant-secret"

const CODE = "code#state"

const authenticated = (account?: {
	email: string | null
	plan: string | null
}): CheckReport => ({
	connection: "ready",
	binaryVersion: null,
	authenticated: true,
	error: null,
	account,
})

const NOT_AUTHENTICATED: CheckReport = {
	connection: "ready",
	binaryVersion: null,
	authenticated: false,
	error: null,
}

let port: FakeOnboardingPort
let controller: OnboardingController
let sent: string[]
let firstRunDone: number

const createController = () => {
	port = createFakeOnboardingPort()
	sent = []
	firstRunDone = 0

	return createOnboardingController(port, {
		send: async (text) => {
			sent.push(text)
		},
		markFirstRunDone: async () => {
			firstRunDone += 1
		},
	})
}

const commands = () => port.calls.map(({ command }) => command)

beforeEach(() => {
	controller = createController()
})

describe("the welcome step", () => {
	it("opens on the welcome card", () => {
		expect(controller.getState().step).toBe("welcome")
		expect(controller.getState().card).toBeNull()
	})

	it("reads the account when the reader starts", async () => {
		port.report = NOT_AUTHENTICATED

		await controller.start()

		expect(commands()).toEqual(["check"])
	})

	it("reads the account when the reader asks to hear more first", async () => {
		port.report = NOT_AUTHENTICATED

		await controller.tellMore()

		expect(commands()).toEqual(["check"])
	})
})

describe("reading the account", () => {
	it("names the email and the plan on the detected card", async () => {
		port.report = authenticated({ email: EMAIL, plan: "Max" })

		await controller.start()

		expect(controller.getState().card).toEqual({
			state: "detected",
			account: `${EMAIL} · Max`,
		})
	})

	it("names the email alone when the report carries no plan", async () => {
		port.report = authenticated({ email: EMAIL, plan: null })

		await controller.start()

		expect(controller.getState().card).toEqual({
			state: "detected",
			account: EMAIL,
		})
	})

	it("settles without a card when the report carries no email", async () => {
		port.report = authenticated({ email: null, plan: null })

		await controller.start()

		expect(controller.getState().step).toBe("summoned")
		expect(controller.getState().card).toBeNull()
		expect(controller.getState().hasSettled).toBe(true)
	})

	it("offers the sign-in when nobody is authenticated", async () => {
		port.report = NOT_AUTHENTICATED

		await controller.start()

		expect(controller.getState().card).toEqual({ state: "offer" })
	})

	it("fails visibly when the check is refused", async () => {
		port.refusals.check = { kind: "authCheckFailed", detail: "no keychain" }

		await controller.start()

		expect(controller.getState().card).toEqual({
			state: "failed",
			exitDetail: "no keychain",
		})
	})
})

describe("the detected card", () => {
	beforeEach(async () => {
		port.report = authenticated({ email: EMAIL, plan: null })
		await controller.start()
	})

	it("settles on the account the reader keeps", async () => {
		await controller.acceptAccount()

		expect(controller.getState().step).toBe("summoned")
	})

	it("offers the sign-in when the reader wants another account", () => {
		controller.changeAccount()

		expect(controller.getState().card).toEqual({ state: "offer" })
	})
})

describe("signing in", () => {
	beforeEach(async () => {
		port.report = NOT_AUTHENTICATED
		await controller.start()
	})

	it("opens the announced url and waits on it", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.announceStarted(SIGN_IN_URL)
		await Promise.resolve()

		expect(controller.getState().card).toEqual({
			state: "waiting",
			signInUrl: SIGN_IN_URL,
		})
		expect(port.calls).toContainEqual({
			command: "openSignInUrl",
			value: SIGN_IN_URL,
		})

		port.completeSignIn()
		await signingIn
	})

	it("frees the waiting card once the browser step is on screen", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		expect(controller.getState().isBusy).toBe(true)

		port.announceStarted(SIGN_IN_URL)
		await Promise.resolve()
		expect(controller.getState().isBusy).toBe(false)

		port.completeSignIn()
		await signingIn
	})

	it("settles once the sign-in lands", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.completeSignIn()
		await signingIn

		expect(controller.getState().step).toBe("summoned")
	})

	it("shows the detail the rejection carries", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.refuseSignIn({ kind: "failed", detail: "auth login exited with 1" })
		await signingIn

		expect(controller.getState().card).toEqual({
			state: "failed",
			exitDetail: "auth login exited with 1",
		})
	})

	it("shows the kind when the rejection carries no detail", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.refuseSignIn({ kind: "timedOut" })
		await signingIn

		expect(controller.getState().card).toEqual({
			state: "failed",
			exitDetail: "timedOut",
		})
	})

	it("sends the code the waiting card submits", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.announceStarted(SIGN_IN_URL)
		await controller.submitCode(CODE)

		expect(port.calls).toContainEqual({ command: "enterCode", value: CODE })

		port.completeSignIn()
		await signingIn
	})

	it("leaves the step alone when the code lands on no running sign-in", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.announceStarted(SIGN_IN_URL)
		await Promise.resolve()
		port.refusals.enterCode = { kind: "notRunning" }

		await controller.submitCode(CODE)

		expect(controller.getState().card).toEqual({
			state: "waiting",
			signInUrl: SIGN_IN_URL,
		})

		port.completeSignIn()
		await signingIn
	})

	it("goes back to the offer when the reader takes the key instead", async () => {
		const signingIn = controller.signIn()
		await Promise.resolve()
		port.announceStarted(SIGN_IN_URL)
		await Promise.resolve()

		await controller.pasteKeyInstead()
		await signingIn

		expect(commands()).toContain("cancelSignIn")
		expect(controller.getState().card).toEqual({ state: "offer" })
	})

	it("raises no notice when the cancel lands on no running sign-in", async () => {
		port.refusals.cancelSignIn = { kind: "notRunning" }

		await controller.pasteKeyInstead()

		expect(controller.getState().card).toEqual({ state: "offer" })
	})
})

describe("the api key", () => {
	beforeEach(async () => {
		port.report = NOT_AUTHENTICATED
		await controller.start()
	})

	it("holds the key and reads the account again", async () => {
		port.report = authenticated({ email: EMAIL, plan: null })

		await controller.submitApiKey(API_KEY)

		expect(port.calls).toContainEqual({
			command: "holdApiKey",
			value: API_KEY,
		})
		expect(commands().at(-1)).toBe("check")
		expect(controller.getState().card).toEqual({
			state: "detected",
			account: EMAIL,
		})
	})

	it("fails visibly when the key is refused", async () => {
		port.refusals.holdApiKey = { kind: "unwritable", detail: "read only" }

		await controller.submitApiKey(API_KEY)

		expect(controller.getState().card).toEqual({
			state: "failed",
			exitDetail: "read only",
		})
	})
})

describe("the summons", () => {
	it("asks for a greeting when the reader started", async () => {
		port.report = authenticated({ email: null, plan: null })

		await controller.start()

		expect(sent).toEqual([onboardingSummonsFor("greeting")])
	})

	it("asks what the companion is for when the reader wanted to hear more", async () => {
		port.report = authenticated({ email: null, plan: null })

		await controller.tellMore()

		expect(sent).toEqual([onboardingSummonsFor("purpose")])
	})

	it("keeps the pill on screen once the connection settled", async () => {
		port.report = authenticated({ email: null, plan: null })
		await controller.start()

		await controller.pasteKeyInstead()

		expect(controller.getState().hasSettled).toBe(true)
	})

	it("summons again when the reader retries the failed turn", async () => {
		port.report = authenticated({ email: null, plan: null })
		await controller.start()

		await controller.summonAgain()

		expect(sent).toHaveLength(2)
	})
})

describe("the end of the first run", () => {
	it("marks the first run done and leaves no card", async () => {
		port.report = authenticated({ email: null, plan: null })
		await controller.start()

		await controller.finish()

		expect(controller.getState().step).toBe("done")
		expect(controller.getState().card).toBeNull()
		expect(firstRunDone).toBe(1)
	})
})
