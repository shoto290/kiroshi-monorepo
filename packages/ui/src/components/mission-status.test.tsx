// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { MissionStatus } from "@workspace/ui/components/mission"
import {
	MissionCard,
	type MissionCardProps,
} from "@workspace/ui/components/mission-card"
import { MissionHeader } from "@workspace/ui/components/mission-header"
import {
	MissionRow,
	type MissionRowModel,
} from "@workspace/ui/components/mission-row"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"

import "@workspace/ui/lib/i18n"

const NOW = new Date("2026-03-04T09:30:00Z").getTime()

const BLANK_STATUS: MissionStatus = { text: " \n\t ", writtenAt: NOW - 240_000 }

const TICKET = {
	externalId: "OPE-30",
	title: "Mission thread screen",
	platform: "linear",
	url: "https://linear.example/kiroshi/issue/OPE-30",
}

const BOT = { name: "Ada Martin", animal: "owl" as const, seed: "bot-ada" }

const CARD: Omit<MissionCardProps, "onOpen"> = {
	id: "mission-ope-30",
	objective: "Ship the mission card",
	ticket: TICKET,
	tools: ["GitHub"],
	state: "waiting_human",
	isWorking: false,
	isClosed: false,
}

const ROW: MissionRowModel = {
	id: "mission-ope-30",
	objective: "Ship the mission row",
	ticket: TICKET,
	bot: BOT,
	state: "waiting_human",
	isWorking: false,
	timestamp: "2d",
}

const STATUS_SLOTS =
	'[data-slot="mission-status"], [data-slot="mission-status-time"]'

const open = () => {}

afterEach(cleanup)

describe("a mission status holding only whitespace", () => {
	it("draws no status and no time on the card", () => {
		const { container } = render(
			<MissionCard {...CARD} now={NOW} onOpen={open} status={BLANK_STATUS} />,
		)

		expect(container.querySelectorAll(`${STATUS_SLOTS}, time`)).toHaveLength(0)
	})

	it("draws no status and no time on the row", () => {
		const { container } = render(
			<SidebarProvider>
				<ul>
					<MissionRow {...ROW} now={NOW} onOpen={open} status={BLANK_STATUS} />
				</ul>
			</SidebarProvider>,
		)

		expect(container.querySelectorAll(`${STATUS_SLOTS}, time`)).toHaveLength(0)
	})

	it("draws no status, no rule of its own and no status time on the header", () => {
		const { container } = render(
			<MissionHeader
				bot={BOT}
				isWorking={false}
				now={NOW}
				objective={CARD.objective}
				onBack={open}
				openedAt={NOW - 5_400_000}
				state="working"
				status={BLANK_STATUS}
				ticket={TICKET}
				tools={CARD.tools}
			/>,
		)

		expect(container.querySelectorAll(STATUS_SLOTS)).toHaveLength(0)
		expect(
			container.querySelectorAll('[data-slot="mission-ticket-rule"]'),
		).toHaveLength(1)
		expect(container.querySelectorAll("time")).toHaveLength(1)
	})

	it("refuses a status passed without the instant it is read at", () => {
		const status: MissionStatus = { text: "Running", writtenAt: NOW }
		const card = (
			// @ts-expect-error a status travels with the instant it is read at
			<MissionCard {...CARD} onOpen={open} status={status} />
		)
		const row = (
			// @ts-expect-error a status travels with the instant it is read at
			<MissionRow {...ROW} onOpen={open} status={status} />
		)

		expect([card, row]).toHaveLength(2)
	})
})
