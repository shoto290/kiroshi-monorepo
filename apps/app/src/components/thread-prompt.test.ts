// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import "@workspace/ui/lib/i18n"

import { QuestionPrompt } from "@/components/thread-prompt"
import type { QuestionRequest, QuestionSubject } from "@/lib/agent/contract"
import type { Application } from "@/lib/applications/application-port"
import { createFakeApplicationPort } from "@/lib/applications/fake-application-port"
import { ConversationApplicationsContext } from "@/lib/applications/use-conversation-installs"
import type { PromptResponder } from "@/lib/chat/use-prompt-responder"

afterEach(cleanup)

const SENTRY_LOGO = "https://logo.test/sentry.png"

const SENTRY: Application = {
	name: "sentry",
	title: "Sentry",
	description: "Pulls the errors behind a release.",
	config: {},
	tools: [],
	logo: SENTRY_LOGO,
	install: {
		kind: "key",
		fields: [{ name: "token", secret: "SENTRY_AUTH_TOKEN" }],
	},
}

const RESPONDER: PromptResponder = {
	answer: async () => undefined,
	respond: async () => undefined,
}

const scopeQuestion = (subject?: QuestionSubject): QuestionRequest => ({
	id: "q-1",
	questions: [
		{
			header: "Scope",
			question: "Where should Sentry go?",
			options: [
				{ label: "Everywhere", description: null, preview: null },
				{ label: "This companion", description: null, preview: null },
			],
			multiSelect: false,
		},
	],
	subject,
})

const renderPrompt = (request: QuestionRequest) =>
	render(
		createElement(
			ConversationApplicationsContext.Provider,
			{
				value: {
					port: createFakeApplicationPort(),
					curated: [SENTRY],
					spaces: [],
					onOpen: () => undefined,
				},
			},
			createElement(QuestionPrompt, { request, responder: RESPONDER }),
		),
	)

const drawnMark = () => document.querySelector(`img[src="${SENTRY_LOGO}"]`)

describe("QuestionPrompt", () => {
	it("draws the mark of the application a scope question is about", () => {
		renderPrompt(
			scopeQuestion({ kind: "applicationScope", application: "sentry" }),
		)

		expect(drawnMark()).not.toBeNull()
		expect(screen.getByText("Where should Sentry go?")).toBeTruthy()
	})

	it("asks a scope question about an application the catalogue does not name as an ordinary question", () => {
		renderPrompt(
			scopeQuestion({ kind: "applicationScope", application: "ledger" }),
		)

		expect(drawnMark()).toBeNull()
		expect(screen.getByText("Everywhere")).toBeTruthy()
		expect(screen.getByText("This companion")).toBeTruthy()
	})

	it("draws no mark on a question with no subject", () => {
		renderPrompt(scopeQuestion())

		expect(drawnMark()).toBeNull()
	})
})
