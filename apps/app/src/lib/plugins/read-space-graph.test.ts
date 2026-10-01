import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	APPROXIMATE_CHARS_PER_TOKEN,
	readSpaceGraph,
	type SpaceGraphStore,
} from "./read-space-graph"

import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import { botPlugin } from "../conversations/plugin-scope"

const SPACE = { id: "personal", name: "Personal" }

const COMPANION = botPlugin("default")

const A_SKILL = {
	name: "Release notes",
	description: "How this project words a changelog entry",
	body: "One line per change.",
}

const NOTES = "x".repeat(400)

const FIRST_WRITE = "2026-03-01T09:00:00.000Z"

const SECOND_WRITE = "2026-03-02T09:00:00.000Z"

const OBSERVED_AT = new Date("2026-03-03T09:00:00.000Z")

const refused = () => Promise.reject(new Error("refused"))

const ownSkillsOf = async (store: SpaceGraphStore) => {
	const graph = await readSpaceGraph(store, SPACE, OBSERVED_AT)
	if (graph.status !== "ready") throw new Error(`read ${graph.status}`)
	return graph.graph
}

const writtenAt = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] })
})

afterEach(() => {
	vi.useRealTimers()
})

describe("the space graph read", () => {
	it("draws each bot of the space with the skills and applications of its own plugin", async () => {
		const store = createFakeTranscriptStore()
		const skill = await store.createPluginSkill(COMPANION, A_SKILL)
		await store.writePluginSkillFile(COMPANION, skill.id, "notes.md", NOTES)
		await store.setPluginMcpServer(COMPANION, "github", { command: "gh" })

		const graph = await ownSkillsOf(store)

		expect(graph.bots).toEqual([
			{ id: "default", name: "Claude", blot: undefined, isWorking: false },
		])
		expect(graph.plugins).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Release notes",
					kind: "skill",
					scope: "bot",
					tokens: Math.ceil(
						(A_SKILL.body.length + NOTES.length) / APPROXIMATE_CHARS_PER_TOKEN,
					),
					loadedBy: ["default"],
				}),
				expect.objectContaining({
					name: "github",
					kind: "application",
					scope: "bot",
					loadedBy: ["default"],
				}),
			]),
		)
	})

	it("dates a skill by the newest commit touching its folder", async () => {
		const store = createFakeTranscriptStore()
		writtenAt(FIRST_WRITE)
		await store.createPluginSkill(COMPANION, A_SKILL)
		writtenAt(SECOND_WRITE)
		await store.createPluginSkill(COMPANION, { ...A_SKILL, name: "Triage" })

		const graph = await ownSkillsOf(store)
		const lastWriteOf = (name: string) =>
			graph.plugins.find((plugin) => plugin.name === name)?.lastWriteAt

		expect(lastWriteOf("Release notes")).toBe(FIRST_WRITE)
		expect(lastWriteOf("Triage")).toBe(SECOND_WRITE)
	})

	it("falls back to the newest commit of the plugin when none touches the skill", async () => {
		const fake = createFakeTranscriptStore()
		await fake.createPluginSkill(COMPANION, A_SKILL)
		const store: SpaceGraphStore = {
			...fake,
			pluginHistory: async () => [
				{
					id: "commit-memory",
					timestamp: Date.parse(SECOND_WRITE) / 1000,
					author: "bot",
					title: "Memory",
					body: "",
					paths: ["CLAUDE.md"],
				},
			],
		}

		const graph = await ownSkillsOf(store)

		expect(graph.plugins).toContainEqual(
			expect.objectContaining({
				name: "Release notes",
				lastWriteAt: SECOND_WRITE,
			}),
		)
	})

	it("draws the bots alone when their plugins hold nothing", async () => {
		const store: SpaceGraphStore = {
			...createFakeTranscriptStore(),
			pluginSkills: async () => [],
		}

		const graph = await ownSkillsOf(store)

		expect(graph.bots).toHaveLength(1)
		expect(graph.plugins).toEqual([])
	})

	it("reads no plugin but the bots' own", async () => {
		const fake = createFakeTranscriptStore()
		const store = { ...fake, pluginSkills: vi.fn(fake.pluginSkills) }

		await readSpaceGraph(store, SPACE, OBSERVED_AT)

		expect(store.pluginSkills.mock.calls).toEqual([[COMPANION]])
	})

	it("names every read that failed with the bot it belongs to", async () => {
		const store: SpaceGraphStore = {
			...createFakeTranscriptStore(),
			pluginMcpServers: refused,
			pluginHistory: refused,
		}

		const graph = await readSpaceGraph(store, SPACE, OBSERVED_AT)

		expect(graph).toEqual({
			status: "failed",
			failures: [
				{ read: "applications", botName: "Claude" },
				{ read: "history", botName: "Claude" },
			],
		})
	})

	it("fails on the bots when they cannot be read", async () => {
		const store: SpaceGraphStore = {
			...createFakeTranscriptStore(),
			bots: refused,
		}

		const graph = await readSpaceGraph(store, SPACE, OBSERVED_AT)

		expect(graph).toEqual({ status: "failed", failures: [{ read: "bots" }] })
	})
})
