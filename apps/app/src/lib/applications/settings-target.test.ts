// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react"
import { createElement, Fragment } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BOT_MCP_SERVERS } from "@workspace/ui/components/bot-settings-dialog/mcp-servers.fixtures"
import { SPACE_ENVIRONMENT } from "@workspace/ui/components/environment.fixtures"
import {
	HISTORY_DAYS,
	HISTORY_OLDEST_DATE,
} from "@workspace/ui/components/plugin-settings/history.fixtures"
import { BOT_SKILLS } from "@workspace/ui/components/plugin-settings/skills.fixtures"
import { SpaceSettingsDialog } from "@workspace/ui/components/space-settings-dialog"
import { UserSettingsDialog } from "@workspace/ui/components/user-settings-dialog"

import "@workspace/ui/lib/i18n"

import { applicationToOpenIn, type SettingsTarget } from "./settings-target"

import { CONNECTORS_TAB } from "@/lib/connectors/connector-settings"

const SPACE_ID = "space-of-the-release"
const READER = "Reader"
const SPACE_NAME = "Release desk"
const SHARED_APPLICATION = "atlas"

const HISTORY = {
	days: HISTORY_DAYS,
	oldestDate: HISTORY_OLDEST_DATE,
	onUndo: vi.fn(),
}

const SKILL_HANDLERS = {
	skills: BOT_SKILLS,
	onSkillChange: vi.fn(),
	onSkillCreate: vi.fn(),
	onSkillDelete: vi.fn(),
	onSkillPreloadedChange: vi.fn(),
}

const APPLICATION_HANDLERS = {
	onServerChange: vi.fn(),
	onServerCreate: vi.fn(),
	onServerDelete: vi.fn(),
}

type SettingsProps = { application?: SettingsTarget }

const OpenedSettings = ({ application }: SettingsProps) =>
	createElement(
		Fragment,
		null,
		createElement(UserSettingsDialog, {
			applications: {
				...APPLICATION_HANDLERS,
				servers: BOT_MCP_SERVERS,
				serverToOpen: applicationToOpenIn({ kind: "user" }, application),
			},
			history: HISTORY,
			language: null,
			onClose: vi.fn(),
			onLanguageChange: vi.fn(),
			onPictureUpload: vi.fn(),
			onValueChange: vi.fn(),
			open: true,
			tab: CONNECTORS_TAB,
			value: { name: READER, colorScheme: "system" as const },
			...SKILL_HANDLERS,
		}),
		createElement(SpaceSettingsDialog, {
			environment: SPACE_ENVIRONMENT,
			history: HISTORY,
			mcpServers: BOT_MCP_SERVERS,
			mcpServerToOpen: applicationToOpenIn(
				{ kind: "space", id: SPACE_ID },
				application,
			),
			onClose: vi.fn(),
			onDelete: vi.fn(),
			onEnvironmentDelete: vi.fn(),
			onEnvironmentSet: vi.fn(),
			onMcpServerChange: vi.fn(),
			onMcpServerCreate: vi.fn(),
			onMcpServerDelete: vi.fn(),
			onValueChange: vi.fn(),
			open: true,
			tab: CONNECTORS_TAB,
			value: { name: SPACE_NAME, colour: "blue" as const },
			...SKILL_HANDLERS,
		}),
	)

const BEHIND_ANOTHER_DIALOG = { hidden: true }

const dialogNamed = (name: string) =>
	screen.getByRole("dialog", {
		...BEHIND_ANOTHER_DIALOG,
		name: new RegExp(name),
	})

const openedApplicationIn = (dialog: HTMLElement) =>
	within(dialog).queryByRole("button", {
		...BEHIND_ANOTHER_DIALOG,
		name: "Remove application",
	})

const listedApplicationIn = (dialog: HTMLElement) =>
	within(dialog).queryByRole("button", {
		...BEHIND_ANOTHER_DIALOG,
		name: new RegExp(SHARED_APPLICATION),
	})

afterEach(cleanup)

describe("opening an application on one scope", () => {
	it("leaves the other scope settings on its list", () => {
		const { rerender } = render(createElement(OpenedSettings))

		rerender(
			createElement(OpenedSettings, {
				application: {
					scope: { kind: "space", id: SPACE_ID },
					application: SHARED_APPLICATION,
				},
			}),
		)

		const profile = dialogNamed(READER)
		expect(listedApplicationIn(profile)).toBeTruthy()
		expect(openedApplicationIn(profile)).toBe(null)
		expect(openedApplicationIn(dialogNamed(SPACE_NAME))).toBeTruthy()
	})
})
