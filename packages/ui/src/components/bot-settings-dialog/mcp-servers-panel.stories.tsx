import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import type { BotMcpServerItem } from "@workspace/ui/components/bot-settings"
import {
	BOT_MCP_SERVERS,
	LONG_MCP_SERVER,
} from "@workspace/ui/components/bot-settings-dialog/mcp-servers.fixtures"
import { McpServersPanel } from "@workspace/ui/components/bot-settings-dialog/mcp-servers-panel"

const [LOCAL, REMOTE] = BOT_MCP_SERVERS

const NEEDS_AUTHORIZATION = {
	...LOCAL,
	connection: "needsAuthorization",
} satisfies BotMcpServerItem

const CONNECTING = {
	...LOCAL,
	connection: "connecting",
} satisfies BotMcpServerItem

const CONNECTED = {
	...LOCAL,
	connection: "connected",
} satisfies BotMcpServerItem

const FAILED = { ...LOCAL, connection: "failed" } satisfies BotMcpServerItem

const meta = preview.meta({
	title: "Settings/Bot/McpServersPanel",
	component: McpServersPanel,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Every MCP server a companion declares: the name it connects as and the one line that says what starting it means — a command, a URL, or plainly nothing. This is the resting state and the whole of it — taking a row hands the entire dialog to that server, rail included, because a server is a program somebody is about to run on their own machine and it needs both the height and a summary of its own. The panel keeps nothing: it lists what it is given and reports which row was taken.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="flex h-[28rem] w-[36rem] flex-col gap-4 p-5">
				<Story />
			</div>
		),
	],
	args: {
		servers: BOT_MCP_SERVERS,
		onOpen: fn(),
		onAdd: fn(),
		onConnect: fn(),
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A companion declaring all three kinds at once. Check that each row says what starting it means in one line — which is the whole of what the list has to answer at a glance — and that the row whose configuration names neither keeps the same height as the others. Taking a row reports the server itself, never its name.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: /atlas/ }))

		await expect(args.onOpen).toHaveBeenCalledWith(LOCAL)
	},
})

export const Empty = meta.story({
	args: { servers: [] },
	parameters: {
		docs: {
			description: {
				story:
					"A companion nobody has given a server. Reach for this over `Default` to check the one state that has to both say so and offer a way out of it: the sentence says what an MCP server is and what adding one lets the companion do, before asking for one.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Add connector" }))

		await expect(args.onAdd).toHaveBeenCalledTimes(1)
	},
})

export const LongContent = meta.story({
	args: { servers: [LONG_MCP_SERVER, ...BOT_MCP_SERVERS] },
	parameters: {
		docs: {
			description: {
				story:
					"A server whose name and command both run past the row. Check that each truncates on its own line rather than wrapping the row taller, and that the chevron holds its place at the end whatever the command does.",
			},
		},
	},
})

export const Unreadable = meta.story({
	args: { servers: [], haveFailedToLoad: true },
	parameters: {
		docs: {
			description: {
				story:
					"The read of this companion's servers came back refused. The panel says so instead of showing the empty state, so nobody reads a lost list as a companion that declares no server.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("Couldn't load connectors. Reopen settings to retry."),
		).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: "Add connector" }),
		).not.toBeInTheDocument()
	},
})

export const NeedsAuthorization = meta.story({
	args: { servers: [NEEDS_AUTHORIZATION] },
	parameters: {
		docs: {
			description: {
				story:
					"A connector that answered, and answered that nobody has authorized it yet. Reach for this to check the one row state that asks for something: the amber dot and its label say so in two carriers rather than colour alone, and Connect stands in the action lane as a control of its own — pressing it authorizes rather than opening the connector, which is why it is not inside the row button. Use `Failed` for the state that already tried.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText("Needs authorization")).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "Connect atlas" }))

		await expect(args.onConnect).toHaveBeenCalledWith(NEEDS_AUTHORIZATION)
	},
})

export const Connecting = meta.story({
	args: { servers: [CONNECTING] },
	parameters: {
		docs: {
			description: {
				story:
					"The row while a browser tab is open on the connector's own sign-in. Check that the lane says so on its own — a muted pulsing dot and a label that reads as unfinished — and that the action lane stays empty at its width rather than offering a second Connect on top of the one already in flight. The whole of what can be done from here is in the editor.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Connecting…")).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: "Connect atlas" }),
		).not.toBeInTheDocument()
	},
})

export const Connected = meta.story({
	args: { servers: [CONNECTED] },
	parameters: {
		docs: {
			description: {
				story:
					"The resting state of an authorized connector. Check that it says Connected and asks for nothing: no action in the lane, because disconnecting is a decision taken in the editor behind a question, never a press away from a list.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Connected")).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: /Connect atlas|Retry atlas/ }),
		).not.toBeInTheDocument()
	},
})

export const Failed = meta.story({
	args: { servers: [FAILED] },
	parameters: {
		docs: {
			description: {
				story:
					"A connector whose last attempt came back refused. Reach for this over `NeedsAuthorization` to check the state that has already been tried: the destructive dot, a label that says the attempt rather than the requirement, and Retry on the quieter button, because a second attempt is offered rather than asked for.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText("Couldn’t connect")).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "Retry atlas" }))

		await expect(args.onConnect).toHaveBeenCalledWith(FAILED)
	},
})

export const Unanswered = meta.story({
	args: { servers: [CONNECTED, REMOTE] },
	parameters: {
		docs: {
			description: {
				story:
					"A connector no session has answered for yet, beside one that has. Reach for this to check that silence is drawn as silence: no dot, no label and no action on the second row, rather than a guess at connected or a spinner that would never end. Check that both lanes hold their width so the two chevrons stay on the same line.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Connected")).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: /Connect ledger|Retry ledger/ }),
		).not.toBeInTheDocument()
		await expect(
			canvas.getByRole("button", { name: "Open ledger" }),
		).toBeVisible()
	},
})
