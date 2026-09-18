// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import "@workspace/ui/lib/i18n"

import { bots } from "@workspace/ui/lib/i18n-en/bots"

import { ApplicationInstallRow } from "@/components/application-install-row"
import type {
	Application,
	ApplicationInstall,
	InstallCase,
} from "@/lib/applications/application-port"

const INLINE_LOGO = '<svg viewBox="0 0 8 8"><rect width="8" height="8"/></svg>'
const REMOTE_ICON = "https://icons.test/forecast.png"

const CONNECTION_WORDING = [
	bots.applications.catalogue.setup.apiKey,
	bots.applications.catalogue.setup.signIn,
	bots.applications.catalogue.setup.unavailable,
	bots.applications.connection.state.connected,
]

const INSTALL_CASES: InstallCase[] = [
	{ kind: "nothing" },
	{ kind: "key", secrets: ["FORECAST_API_KEY"] },
	{ kind: "oauth" },
]

const anInstall = (held: Partial<ApplicationInstall>): ApplicationInstall => ({
	id: "i1",
	conversationId: "c1",
	application: "io.test/forecast",
	title: "Forecast",
	scope: "user",
	install: { kind: "nothing" },
	lastMessageSeq: 0,
	createdAt: 1,
	...held,
})

const CURATED: Application = {
	name: "io.test/forecast",
	title: "Forecast",
	description: "The curated description.",
	config: {},
	logoUrl: "https://icons.test/curated.png",
	install: { kind: "nothing" },
}

type RenderedRow = {
	install: ApplicationInstall
	curated?: Application
}

const rendered = ({ install, curated }: RenderedRow) =>
	render(
		createElement(ApplicationInstallRow, {
			install,
			curated,
			destinationName: undefined,
			isLeftOut: false,
			onOpenSettings: () => undefined,
		}),
	).container

const slotOf = (container: HTMLElement, slot: string) =>
	container.querySelector(`[data-slot="${slot}"]`)

afterEach(cleanup)

describe("ApplicationInstallRow", () => {
	it.each(INSTALL_CASES)(
		"claims no connection for a $kind install",
		(install) => {
			const container = rendered({ install: anInstall({ install }) })
			const card = slotOf(container, "application-card")

			for (const wording of CONNECTION_WORDING) {
				expect(card?.textContent).not.toContain(wording)
			}
			expect(slotOf(container, "application-card-status")).toBeNull()
			expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy()
		},
	)

	it("draws the mark of a row carrying only a logoUrl from that url, and one carrying only a logo from that logo", () => {
		const remote = rendered({ install: anInstall({ logoUrl: REMOTE_ICON }) })
		expect(slotOf(remote, "application-mark")?.querySelector("img")?.src).toBe(
			REMOTE_ICON,
		)
		cleanup()

		const inline = rendered({ install: anInstall({ logo: INLINE_LOGO }) })
		const mark = slotOf(inline, "application-mark")
		expect(mark?.querySelector("img")).toBeNull()
		expect(mark?.querySelector("rect")).not.toBeNull()
	})

	it("names the receipt from the title of the row and describes it from the row", () => {
		const container = rendered({
			install: anInstall({ description: "Reads the weather." }),
		})

		expect(slotOf(container, "application-card-name")?.textContent).toBe(
			"Forecast",
		)
		expect(slotOf(container, "application-card-description")?.textContent).toBe(
			"Reads the weather.",
		)
	})

	it("falls back to the curated mark and description for a row carrying neither", () => {
		const container = rendered({ install: anInstall({}), curated: CURATED })

		expect(
			slotOf(container, "application-mark")?.querySelector("img")?.src,
		).toBe(CURATED.logoUrl)
		expect(slotOf(container, "application-card-description")?.textContent).toBe(
			CURATED.description,
		)
	})

	it("draws the placeholder and no description line for an uncurated row carrying neither", () => {
		const container = rendered({ install: anInstall({}) })
		const mark = slotOf(container, "application-mark")

		expect(mark?.querySelector("img")).toBeNull()
		expect(mark?.querySelector("svg")).not.toBeNull()
		expect(slotOf(container, "application-card-description")).toBeNull()
	})
})
