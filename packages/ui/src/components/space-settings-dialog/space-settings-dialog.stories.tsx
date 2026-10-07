import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { expect, fireEvent, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	glyphIn,
	probedStyleOf,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { BLOT_TINTS } from "@workspace/ui/components/bot-settings"
import { DangerZone } from "@workspace/ui/components/bot-settings-dialog/danger-zone"
import { BOT_MCP_SERVERS } from "@workspace/ui/components/bot-settings-dialog/mcp-servers.fixtures"
import { SPACE_ENVIRONMENT } from "@workspace/ui/components/environment.fixtures"
import { Icons } from "@workspace/ui/components/icons"
import {
	endNotice,
	NoticeSurface,
	raiseFailureNotice,
	raiseTransientNotice,
} from "@workspace/ui/components/notice-surface"
import {
	HISTORY_DAYS,
	HISTORY_OLDEST_DATE,
} from "@workspace/ui/components/plugin-settings/history.fixtures"
import { BOT_SKILLS } from "@workspace/ui/components/plugin-settings/skills.fixtures"
import {
	SpaceSettingsDialog,
	type SpaceSettingsDialogProps,
	type SpaceSettingsValue,
} from "@workspace/ui/components/space-settings-dialog"
import { JoinedSpaceFields } from "@workspace/ui/components/space-settings-dialog/joined-space-fields"
import {
	MembersPanel,
	type MembersPanelProps,
	type SpaceMember,
} from "@workspace/ui/components/space-settings-dialog/members-panel"
import { SHARE_LINK } from "@workspace/ui/components/space-settings-dialog/share-link.fixtures"

const FILLED_SPACE: SpaceSettingsValue = {
	name: "Release desk",
	colour: "blue",
}

const DialogHost = (props: SpaceSettingsDialogProps) => {
	const [value, setValue] = useState(props.value)
	const [open, setOpen] = useState(props.open)

	return (
		<SpaceSettingsDialog
			{...props}
			onClose={() => {
				setOpen(false)
				props.onClose()
			}}
			onValueChange={(next) => {
				setValue(next)
				props.onValueChange(next)
			}}
			open={open}
			value={value}
		/>
	)
}

const dialogIn = async () => {
	const dialog = await screen.findByRole("dialog")
	await waitFor(() => expect(dialog).toBeVisible())
	return dialog
}

const meta = preview.meta({
	title: "Settings/Space/SpaceSettingsDialog",
	component: SpaceSettingsDialog,
	parameters: {
		layout: "fullscreen",
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				component:
					"Everything a space is, in one overlay — the reader's own settings, told about a work area instead of a person. A breadcrumb heads it with the space's tint dot and its name, so the dialog is visibly the one that space opened. Down the left is a rail of five entries: the space itself, what it is called and the tint it wears; its secrets, the ones every companion in it starts with; its skills, the plugin every companion in it reads before answering; its applications, the ones every companion in it inherits; its history, everything ever written into that plugin. Below a separator sits the danger zone, set apart in destructive tone exactly as a companion's settings sets it apart, because a space takes its companions with it. It opens on the space every time. Same contract as a companion's settings and for the same reason: fully controlled, saving as you type, no draft, no debounce — closing it is never a question, except while a skill or an application is half written.",
			},
		},
	},
	args: {
		open: true,
		value: FILLED_SPACE,
		onClose: fn(),
		onValueChange: fn(),
		environment: SPACE_ENVIRONMENT,
		onEnvironmentSet: fn(),
		onEnvironmentDelete: fn(),
		skills: BOT_SKILLS,
		onSkillCreate: fn(),
		onSkillChange: fn(),
		onSkillPreloadedChange: fn(),
		onSkillDelete: fn(),
		mcpServers: BOT_MCP_SERVERS,
		onMcpServerCreate: fn(),
		onMcpServerChange: fn(),
		onMcpServerDelete: fn(),
		history: {
			days: HISTORY_DAYS,
			oldestDate: HISTORY_OLDEST_DATE,
			onUndo: fn(),
		},
		onDelete: fn(),
	},
	render: (args) => <DialogHost {...args} />,
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The dialog as it opens on a named space. Check that it lands on the space entry with the name in reach, that the breadcrumb wears the space's tint as a dot and names it, that typing reports the edited name with the tint unchanged, and that picking a swatch reports the tint with the name unchanged. Pick `Skills` and `History` for the space's own plugin, `Danger` for the way out, `LastSpace` for the space that cannot be deleted.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()
		await expect(dialog).toHaveAccessibleName("Release desk Settings")
		await expect(slotsIn(dialog, "space-tint")).toHaveLength(
			BLOT_TINTS.length + 2,
		)

		const space = within(dialog).getByRole("tab", { name: "Space" })
		await expect(space).toHaveAttribute("aria-selected", "true")

		const name = within(dialog).getByLabelText("Name")
		await userEvent.type(name, "!")
		await expect(args.onValueChange).toHaveBeenLastCalledWith({
			name: "Release desk!",
			colour: "blue",
		})

		await userEvent.click(within(dialog).getByRole("radio", { name: "Pink" }))
		await expect(args.onValueChange).toHaveBeenLastCalledWith({
			name: "Release desk!",
			colour: "pink",
		})
	},
})

export const Transfer = meta.story({
	args: {
		onExport: fn(),
		onImport: fn(),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The space tab once the host can move a space between machines: Export this space and Import a space sit under the fields, each firing its own callback. Check that each button reports only its own action, by pointer and by keyboard, and that a dialog given neither callback draws the tab as `Default` does.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()
		const exportSpace = within(dialog).getByRole("button", {
			name: "Export this space",
		})
		const importSpace = within(dialog).getByRole("button", {
			name: "Import a space",
		})

		await userEvent.click(exportSpace)
		await expect(args.onExport).toHaveBeenCalledOnce()
		await expect(args.onImport).not.toHaveBeenCalled()

		await userEvent.click(importSpace)
		await expect(args.onImport).toHaveBeenCalledOnce()
		await expect(args.onExport).toHaveBeenCalledOnce()

		importSpace.focus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onImport).toHaveBeenCalledTimes(2)
		await expect(args.onExport).toHaveBeenCalledOnce()
	},
})

export const ShareLink = meta.story({
	args: {
		shareLink: SHARE_LINK,
		onShareLinkCopy: fn(),
		onExport: fn(),
		onImport: fn(),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The space tab once the host hands out a link to this space: the share link section sits under Colour and above Export this space and Import a space. Check its place in that order, and that a dialog given no link draws the tab as `Transfer` does. Pick `Settings/Space/ShareLink` for each state of the section.",
			},
		},
	},
	play: async () => {
		const dialog = await dialogIn()
		const colour = within(dialog).getByText("Colour")
		const field = within(dialog).getByLabelText("Share link")
		const exportSpace = within(dialog).getByRole("button", {
			name: "Export this space",
		})

		await expect(field).toHaveValue(SHARE_LINK)
		await expect(
			colour.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			field.compareDocumentPosition(exportSpace) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	},
})

export const Environment = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The secrets the space hands to every companion in it — the same panel a companion's settings draws, read at space scope, so each name is the space's own and every one of them can be replaced or removed here. A name a companion redefines is still listed, marked as served from the companion, because the space is where it was written even when it is not the value that runs. Check that adding a name reports it, and that the panel never shows a value back.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(within(dialog).getByRole("tab", { name: "Secrets" }))
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Secrets",
		})

		await expect(within(panel).getByText("ATLAS_TOKEN")).toBeVisible()
		await expect(
			within(panel).getByText("Overridden by Companion"),
		).toBeVisible()

		await userEvent.click(
			within(panel).getByRole("button", { name: "Add secret" }),
		)
		const write = await screen.findByRole("dialog", {
			name: "Add a secret",
		})

		await userEvent.type(within(write).getByLabelText("Name"), "RELEASE_DESK")
		await userEvent.type(within(write).getByLabelText("Value"), "sk-live")
		await userEvent.click(
			within(write).getByRole("button", { name: "Save secret" }),
		)

		await expect(args.onEnvironmentSet).toHaveBeenCalledWith({
			name: "RELEASE_DESK",
			value: "sk-live",
		})
	},
})

export const Skills = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The skills of the space's own plugin — the same panel a companion's settings draws, on the plugin every companion in the space reads before it answers. Check that opening one swaps the whole body for the editor, and that the way back restores the rail on the space entry, as the reader's own dialog does after the same trip.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(within(dialog).getByRole("tab", { name: "Skills" }))
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Skills",
		})

		await userEvent.click(
			within(panel).getByRole("button", { name: /release-notes/ }),
		)
		const back = within(dialog).getByRole("button", { name: "All skills" })
		await expect(back).toBeVisible()

		await userEvent.click(back)
		await expect(
			within(dialog).getByRole("tab", { name: "Skills" }),
		).toBeVisible()
	},
})

export const McpServers = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The servers the space declares, inherited by every companion in it \u2014 the same panel and the same editor a companion\u2019s settings draws, written into the space plugin instead of a companion bundle. A companion that declares a server of the same name wins for itself and leaves this one where it is. Check that opening one swaps the whole body for the editor, and that the way back restores the rail. Pick `McpServersUnavailable` for the listing that could not be read.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(
			within(dialog).getByRole("tab", { name: "Applications" }),
		)
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Applications",
		})

		await userEvent.click(within(panel).getByRole("button", { name: /atlas/ }))
		const back = within(dialog).getByRole("button", {
			name: "All applications",
		})
		await expect(back).toBeVisible()

		await userEvent.click(back)
		await expect(
			within(dialog).getByRole("tab", { name: "Applications" }),
		).toBeVisible()
	},
})

export const OpensOnAnApplication = meta.story({
	args: { tab: "mcp", mcpServerToOpen: "atlas" },
	parameters: {
		docs: {
			description: {
				story:
					"A host that asks for one application of the space: the dialog opens on Applications with the editor of that application pushed over the panel. Check that the way back lands on the panel. Pick `McpServers` for the dialog opened by hand.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const dialog = await dialogIn()
		const back = await within(dialog).findByRole("button", {
			name: "All applications",
		})
		await expect(back).toBeVisible()

		await userEvent.click(back)
		await expect(
			await within(dialog).findByRole("tabpanel", { name: "Applications" }),
		).toBeVisible()
	},
})

export const McpServersUnavailable = meta.story({
	args: { haveMcpServersFailedToLoad: true },
	parameters: {
		docs: {
			description: {
				story:
					"The space plugin could not be read. Check that the panel says so instead of inviting a first server, because an empty list and an unreadable one are not the same fact.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(
			within(dialog).getByRole("tab", { name: "Applications" }),
		)
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Applications",
		})

		await expect(
			within(panel).getByText(
				"Couldn’t load applications. Reopen settings to retry.",
			),
		).toBeVisible()
		await expect(
			within(panel).queryByRole("button", { name: "Add an application" }),
		).toBe(null)
	},
})

export const History = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Everything ever written into the space's plugin, newest first, whoever wrote it. Check that a change the reader made is signed You and one a companion made is signed generically — the space holds many companions, so the entry names none of them — and that asking for the changes of an entry calls back for its diff.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(within(dialog).getByRole("tab", { name: "History" }))
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "History",
		})

		await expect(within(panel).getAllByText("You").length).toBeGreaterThan(0)
		await expect(
			within(panel).getAllByText("A companion").length,
		).toBeGreaterThan(0)
		await expect(within(panel).getAllByRole("listitem")).toHaveLength(6)
	},
})

export const Danger = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The last rail entry, held apart from the other three by a separator and painted in the destructive tone so it is never picked by accident. Check that the entry is reachable by keyboard like any other, that the question names the space rather than asking `Are you sure?`, and that `onDelete` fires once the reader presses through — the dialog deletes nothing itself and does not close on its own. Pick `LastSpace` for the space that refuses to go.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(
			within(dialog).getByRole("tab", { name: "Danger zone" }),
		)
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Danger zone",
		})

		await userEvent.click(
			within(panel).getByRole("button", { name: "Delete space" }),
		)
		const popup = await screen.findByRole("alertdialog")
		await expect(popup).toHaveTextContent("Delete Release desk?")

		await userEvent.click(
			within(popup).getByRole("button", { name: "Delete space" }),
		)
		await expect(args.onDelete).toHaveBeenCalledTimes(1)
	},
})

export const LastSpace = meta.story({
	args: { isDeletable: false },
	parameters: {
		docs: {
			description: {
				story:
					"The only space the reader owns, where deletion is refused. Check that the entry is still there and the control still shown, disabled rather than hidden, that the block states why in place of the consequence, and that pressing it opens no question and reports nothing — the refusal is a fact about the app, not an error the reader made. Pick `Danger` for the space that can go.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()

		await userEvent.click(
			within(dialog).getByRole("tab", { name: "Danger zone" }),
		)
		const panel = await within(dialog).findByRole("tabpanel", {
			name: "Danger zone",
		})
		const trigger = within(panel).getByRole("button", { name: "Delete space" })

		await expect(trigger).toBeDisabled()

		fireEvent.click(trigger)
		await expect(screen.queryByRole("alertdialog")).toBe(null)
		await expect(args.onDelete).not.toHaveBeenCalled()
	},
})

const JOINED_SPACE: SpaceSettingsValue = { name: "Northwind" }

const JOINED_HOST = "http://192.168.1.24:45367"

const JOINED_HINT =
	"This space lives on another Kiroshi. Its name is set there."

const LEAVE_DESCRIPTION =
	"Nothing is deleted on the host. You can join again with its link."

const RAIL = [
	"Space",
	"Secrets",
	"Skills",
	"Applications",
	"History",
	"Danger zone",
]

const JOINED_ARGS = {
	value: JOINED_SPACE,
	host: JOINED_HOST,
	onLeave: fn(),
	onDelete: undefined,
}

const leaveIn = async (dialog: HTMLElement) => {
	await within(dialog).findByRole("tab", { name: "Danger zone" })
	const panel = await within(dialog).findByRole("tabpanel", {
		name: "Danger zone",
	})
	return within(panel).getByRole("button", { name: "Leave space" })
}

const leaveConfirmation = async () => {
	const popup = await screen.findByRole("alertdialog")
	await waitFor(() => expect(popup).toBeVisible())
	return popup
}

export const JoinedSpace = meta.story({
	args: JOINED_ARGS,
	parameters: {
		docs: {
			description: {
				story:
					"The space tab of a space joined from another Kiroshi, artboard J10. It lives on the host, so its name and the host it lives on are read-only here, the host carrying why. It has no colour, no share link and nothing to export or import: the props type refuses them once a host is set. The rail is the local one, entry for entry. Pick `JoinedDanger` for the way out, `JoinedThemes` for both panels in light and dark.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()
		await expect(
			within(dialog)
				.getAllByRole("tab")
				.map((tab) => tab.textContent),
		).toEqual(RAIL)

		const name = within(dialog).getByLabelText("Name")
		await expect(name).toHaveValue("Northwind")
		await expect(name).toHaveAttribute("readonly")
		await userEvent.type(name, "!")
		await expect(name).toHaveValue("Northwind")
		await expect(args.onValueChange).not.toHaveBeenCalled()

		const host = within(dialog).getByLabelText("Host")
		await expect(host).toHaveValue(JOINED_HOST)
		await expect(host).toHaveAttribute("readonly")
		await expect(host).toHaveAccessibleDescription(JOINED_HINT)

		await expect(within(dialog).queryByRole("radio")).toBe(null)
		await expect(within(dialog).queryByText("Colour")).toBe(null)
		await expect(within(dialog).queryByLabelText("Share link")).toBe(null)
		await expect(
			within(dialog).queryByRole("button", { name: "Export this space" }),
		).toBe(null)
		await expect(
			within(dialog).queryByRole("button", { name: "Import a space" }),
		).toBe(null)
	},
})

export const JoinedDanger = meta.story({
	args: { ...JOINED_ARGS, tab: "danger" },
	parameters: {
		docs: {
			description: {
				story:
					"The danger zone of a joined space, artboard J12: one block on the geometry of the local Delete block, saying what leaving keeps on the host, and a destructive Leave space button led by the leave glyph. There is no Delete block, the space is not this machine's to delete. Pressing it asks J4, naming the space, Cancel first. Check that cancelling reports nothing and that confirming reports `onLeave` once. Pick `Danger` for the local space.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const dialog = await dialogIn()
		const leave = await leaveIn(dialog)
		const panel = within(dialog).getByRole("tabpanel", { name: "Danger zone" })

		await expect(
			within(panel).queryByRole("button", { name: "Delete space" }),
		).toBe(null)
		await expect(panel).toHaveTextContent(LEAVE_DESCRIPTION)
		await expect(glyphIn(leave, Icons.Leave)).not.toBe(null)

		await userEvent.click(leave)
		const asked = await leaveConfirmation()
		await expect(
			within(asked).getByRole("heading", { name: "Leave Northwind?" }),
		).toBeVisible()
		await expect(asked).toHaveTextContent(LEAVE_DESCRIPTION)
		await expect(
			within(asked)
				.getAllByRole("button")
				.map((button) => button.textContent),
		).toEqual(["Cancel", "Leave space"])

		await userEvent.click(within(asked).getByRole("button", { name: "Cancel" }))
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBe(null))
		await expect(args.onLeave).not.toHaveBeenCalled()

		await userEvent.click(leave)
		const confirmed = await leaveConfirmation()
		await userEvent.click(
			within(confirmed).getByRole("button", { name: "Leave space" }),
		)
		await expect(args.onLeave).toHaveBeenCalledOnce()
	},
})

const JoinedPanels = () => {
	const { t } = useTranslation("common")

	return (
		<div className="flex flex-col gap-5">
			<JoinedSpaceFields host={JOINED_HOST} name={JOINED_SPACE.name} />
			<DangerZone
				confirmTitle={t("spaces.leave.title", { name: JOINED_SPACE.name })}
				actionLabel={t("spaces.leave.action")}
				description={t("spaces.leave.description")}
				icon="Leave"
				onConfirm={fn()}
			/>
		</div>
	)
}

export const JoinedThemes = meta.story({
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				story:
					"Both joined panels, the Space tab over the Danger zone, in light and dark side by side as artboard J11 lays them. Each read-only control keeps the box of an editable field, a 1px `input` outline at 14px / 20px inside 8px block and 12px inline padding, with the `muted` fill dropped. The hint sits under Host at 12px / 16px in `muted-foreground`.",
			},
		},
	},
	render: () => <JoinedPanels />,
	play: async ({ canvasElement }) => {
		const columns = slotsIn(canvasElement, "joined-space-fields")
		await expect(columns).toHaveLength(2)

		for (const fields of columns) {
			const theme = fields.parentElement?.parentElement ?? canvasElement
			for (const control of fields.querySelectorAll("input")) {
				const style = getComputedStyle(control)
				await expect(style.borderTopWidth).toBe("1px")
				await expect(style.borderTopColor).toBe(
					probedStyleOf("border-input", "borderTopColor", theme),
				)
				await expect(style.paddingBlockStart).toBe("8px")
				await expect(style.paddingInlineStart).toBe("12px")
				await expect(style.fontSize).toBe("14px")
				await expect(style.lineHeight).toBe("20px")
				await expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)")
			}

			const hint = within(fields).getByText(JOINED_HINT)
			await expect(getComputedStyle(hint).fontSize).toBe("12px")
			await expect(getComputedStyle(hint).lineHeight).toBe("16px")

			const zone = slotIn(theme, "danger-zone")
			await expect(
				within(zone).getByRole("button", { name: "Leave space" }),
			).toBeEnabled()
		}
	},
})

const HOSTING_RAIL = [
	"Space",
	"Members",
	"Hosting",
	"Secrets",
	"Skills",
	"Applications",
	"History",
	"Danger zone",
]

const HOSTING_ARGS = {
	tab: "hosting",
	members: null,
	hosting: "off",
	onHost: fn(),
	onStopHosting: fn(),
	onHostingCancel: fn(),
	onSignIn: fn(),
} as const

const hostingPanelIn = async () => {
	const dialog = await dialogIn()
	return within(dialog).findByRole("tabpanel", { name: "Hosting" })
}

const hostingSwitchIn = async () =>
	within(await hostingPanelIn()).getByRole("switch", {
		name: "Host through Kiroshi",
	})

const hostingQuestion = async (title: string) => {
	const popup = await screen.findByRole("alertdialog")
	await waitFor(() => expect(popup).toBeVisible())
	await expect(
		within(popup).getByRole("heading", { name: title }),
	).toBeVisible()
	return popup
}

const hostingQuestionClosed = () =>
	waitFor(() => expect(screen.queryByRole("alertdialog")).toBe(null))

export const HostingOff = meta.story({
	args: HOSTING_ARGS,
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H1. The Hosting entry sits right after Members, which sits right after Space, wearing the globe. The panel is one switch, off, saying who it lets in and that the space only answers while this computer runs Kiroshi. Pick `HostingConfirmStart` for the question turning it on asks.",
			},
		},
	},
	play: async () => {
		const dialog = await dialogIn()
		await expect(
			within(dialog)
				.getAllByRole("tab")
				.map((tab) => tab.textContent),
		).toEqual(HOSTING_RAIL)
		await expect(
			glyphIn(
				within(dialog).getByRole("tab", { name: "Members" }),
				Icons.Users,
			),
		).not.toBe(null)

		const hosting = await hostingSwitchIn()
		await expect(hosting).not.toBeChecked()
		await expect(hosting).toHaveAccessibleDescription(
			"Invite people who aren’t on your network. Release desk is hosted from this computer only, so they reach it while Kiroshi is open here.",
		)
	},
})

export const HostingConfirmStart = meta.story({
	args: HOSTING_ARGS,
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H2. Turning the switch on asks first, naming the space, Cancel first and Host in the primary style since nothing is lost. Check that Cancel closes it with the switch still off and nothing reported but `onHostingCancel`, and that Host reports `onHost` once and never `onStopHosting`. The story rests on the open question.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const hosting = await hostingSwitchIn()

		await userEvent.click(hosting)
		const cancelled = await hostingQuestion("Host Release desk here?")
		await expect(cancelled).toHaveTextContent(
			"People you invite reach its companions and conversations, which run on this computer.",
		)
		await expect(
			within(cancelled)
				.getAllByRole("button")
				.map((button) => button.textContent),
		).toEqual(["Cancel", "Host Release desk"])
		await userEvent.click(
			within(cancelled).getByRole("button", { name: "Cancel" }),
		)
		await hostingQuestionClosed()
		await expect(hosting).not.toBeChecked()
		await expect(args.onHostingCancel).toHaveBeenCalledOnce()
		await expect(args.onHost).not.toHaveBeenCalled()

		await userEvent.click(hosting)
		const confirmed = await hostingQuestion("Host Release desk here?")
		const host = within(confirmed).getByRole("button", {
			name: "Host Release desk",
		})
		await expect(getComputedStyle(host).backgroundColor).toBe(
			probedStyleOf("bg-primary", "backgroundColor", confirmed),
		)
		await userEvent.click(host)
		await hostingQuestionClosed()
		await expect(args.onHost).toHaveBeenCalledOnce()
		await expect(args.onStopHosting).not.toHaveBeenCalled()
		await expect(args.onHostingCancel).toHaveBeenCalledOnce()

		await userEvent.click(hosting)
		await hostingQuestion("Host Release desk here?")
	},
})

export const HostingConnecting = meta.story({
	args: { ...HOSTING_ARGS, hosting: "connecting" },
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H3. The switch is on and the space is on its way out: a 12px spinner and `Connecting…` in `muted-foreground` under the description, 12px medium, read out as a live status. The spinner holds still under reduced motion; the words carry the state either way.",
			},
		},
	},
	play: async () => {
		const panel = await hostingPanelIn()
		await expect(
			within(panel).getByRole("switch", { name: "Host through Kiroshi" }),
		).toBeChecked()
		const status = within(panel).getByRole("status")
		await expect(status).toHaveTextContent("Connecting…")
		await expect(glyphIn(status, Icons.Loading)).not.toBe(null)
		await expect(getComputedStyle(status).fontSize).toBe("12px")
		await expect(getComputedStyle(status).fontWeight).toBe("500")
	},
})

export const HostingOnline = meta.story({
	args: { ...HOSTING_ARGS, hosting: "online" },
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H4. The space is reachable: an 8px dot in the done green and `Online` in `foreground`, in the same live status, so a reader hears the switch from Connecting… to Online without moving.",
			},
		},
	},
	play: async () => {
		const panel = await hostingPanelIn()
		const status = within(panel).getByRole("status")
		await expect(status).toHaveTextContent("Online")
		await expect(getComputedStyle(status).color).toBe(
			probedStyleOf("text-foreground", "color", panel),
		)
		const dot = status.querySelector("span")
		await expect(dot && getComputedStyle(dot).backgroundColor).toBe(
			probedStyleOf("bg-bot-badge-done", "backgroundColor", panel),
		)
	},
})

export const HostingSignedOut = meta.story({
	args: { ...HOSTING_ARGS, hosting: "signed-out" },
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H5. Hosting goes through a Kiroshi account, so a signed-out reader gets no switch, only why and a primary Sign in ending on the external-link glyph. Check that pressing it reports `onSignIn` once; where it leads is the app's call.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const panel = await hostingPanelIn()
		await expect(within(panel).queryByRole("switch")).toBe(null)
		await expect(panel).toHaveTextContent(
			"Sign in to Kiroshi to invite people who aren’t on your network.",
		)
		const signIn = within(panel).getByRole("button", { name: "Sign in" })
		await expect(glyphIn(signIn, Icons.ExternalLink)).not.toBe(null)

		await userEvent.click(signIn)
		await expect(args.onSignIn).toHaveBeenCalledOnce()
	},
})

const HostingFailureNotice = () => {
	const { t } = useTranslation("settings")

	useEffect(() => {
		const notice = raiseFailureNotice({
			title: t("space.hosting.failed.title", { name: FILLED_SPACE.name }),
			description: t("space.hosting.failed.description"),
		})
		return () => endNotice(notice)
	}, [t])

	return null
}

export const HostingFailed = meta.story({
	args: HOSTING_ARGS,
	decorators: [
		(Story) => (
			<>
				<Story />
				<NoticeSurface />
				<HostingFailureNotice />
			</>
		),
	],
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H6. Hosting could not start: the switch is back off and a failure notice names the space and says what to do, staying until it is closed. The app raises the notice with `raiseFailureNotice` and the catalogue's `space.hosting.failed` copy; the dialog only draws the switch.",
			},
		},
	},
	play: async () => {
		await expect(await hostingSwitchIn()).not.toBeChecked()
		const title = await waitFor(() => slotIn(document.body, "toast-title"))
		await expect(title).toHaveTextContent("Couldn’t host Release desk")
		await expect(slotIn(document.body, "toast-description")).toHaveTextContent(
			"Check your connection and turn it on again.",
		)
	},
})

export const HostingConfirmStop = meta.story({
	args: { ...HOSTING_ARGS, hosting: "online" },
	parameters: {
		docs: {
			description: {
				story:
					"Artboard H7. Turning the switch off while online asks first, naming the space, with Stop hosting in the destructive style since guests are cut off. Check that Cancel leaves the switch on and reports only `onHostingCancel`, and that Stop hosting reports `onStopHosting` once and never `onHost`. The story rests on the open question.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const hosting = await hostingSwitchIn()

		await userEvent.click(hosting)
		const cancelled = await hostingQuestion("Stop hosting Release desk?")
		await expect(cancelled).toHaveTextContent(
			"Guests lose access until you host it again. Nothing is deleted on this computer.",
		)
		await expect(
			within(cancelled)
				.getAllByRole("button")
				.map((button) => button.textContent),
		).toEqual(["Cancel", "Stop hosting"])
		await userEvent.click(
			within(cancelled).getByRole("button", { name: "Cancel" }),
		)
		await hostingQuestionClosed()
		await expect(hosting).toBeChecked()
		await expect(args.onHostingCancel).toHaveBeenCalledOnce()
		await expect(args.onStopHosting).not.toHaveBeenCalled()

		await userEvent.click(hosting)
		const confirmed = await hostingQuestion("Stop hosting Release desk?")
		const stop = within(confirmed).getByRole("button", { name: "Stop hosting" })
		await expect(getComputedStyle(stop).color).toBe(
			probedStyleOf("text-destructive", "color", confirmed),
		)
		await userEvent.click(stop)
		await hostingQuestionClosed()
		await expect(args.onStopHosting).toHaveBeenCalledOnce()
		await expect(args.onHost).not.toHaveBeenCalled()
		await expect(args.onHostingCancel).toHaveBeenCalledOnce()

		await userEvent.click(hosting)
		await hostingQuestion("Stop hosting Release desk?")
	},
})

const STEVE: SpaceMember = {
	id: "steve",
	name: "Steve",
	email: "steve@example.com",
	status: "host",
}

const SAM_PENDING: SpaceMember = {
	id: "sam",
	email: "sam@example.com",
	status: "pending",
}

const SAM_CARTER: SpaceMember = {
	id: "sam",
	name: "Sam Carter",
	email: "sam@example.com",
	status: "joined",
}

const MEMBERS_PANEL = {
	space: "Personal",
	members: [STEVE],
	email: "",
	onEmailChange: fn(),
	onInvite: fn(),
	isHosted: true,
	onOpenHosting: fn(),
	shareLink: SHARE_LINK,
	onShareLinkCopy: fn(),
	onRemove: fn(),
	onWithdraw: fn(),
	onRemoveConfirm: fn(),
	onRemoveCancel: fn(),
} satisfies MembersPanelProps

const membersArgs = (panel: Partial<MembersPanelProps> = {}) => {
	const props = { ...MEMBERS_PANEL, ...panel }

	return {
		...HOSTING_ARGS,
		tab: "members",
		value: { name: "Personal", colour: "blue" },
		hosting: props.isHosted ? "online" : "off",
		members: <MembersPanel {...props} />,
	} as const
}

const membersPanelIn = async () => {
	const dialog = await screen.findByRole("dialog", {
		name: "Personal Settings",
	})
	await waitFor(() => expect(dialog).toBeVisible())
	return within(dialog).findByRole("tabpanel", { name: "Members" })
}

const memberRowsIn = (panel: HTMLElement) =>
	slotsIn(panel, "space-member").map((row) =>
		within(row)
			.getAllByText(/./)
			.map((text) => text.textContent),
	)

const inviteFieldIn = (panel: HTMLElement) =>
	within(panel).getByRole("textbox", { name: "Invite people" })

const expectRefusal = async (panel: HTMLElement, message: string) => {
	const field = inviteFieldIn(panel)
	await expect(field).toHaveAttribute("aria-invalid", "true")
	await expect(field).toHaveAccessibleDescription(message)
	await expect(getComputedStyle(field).borderTopColor).toBe(
		probedStyleOf("border-destructive", "borderTopColor", panel),
	)
	await expect(getComputedStyle(field).boxShadow).toContain(
		probedStyleOf("text-destructive/20", "color", panel),
	)
	await expect(panel).not.toHaveTextContent(
		"They join by signing in to Kiroshi with this email.",
	)
}

export const MembersI1 = meta.story({
	args: membersArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I1. The Members tab of a hosted space: an empty invite field with Invite disabled, the member list holding only the reader, tagged Host with no Remove, then the share link.",
			},
		},
	},
	play: async () => {
		const panel = await membersPanelIn()
		await expect(
			within(panel).getByRole("button", { name: "Invite" }),
		).toBeDisabled()
		await expect(inviteFieldIn(panel)).toHaveAccessibleDescription(
			"They join by signing in to Kiroshi with this email.",
		)
		await expect(memberRowsIn(panel)).toEqual([
			["S", "Steve", "steve@example.com", "Host"],
		])
		await expect(within(panel).queryByRole("button", { name: /^Remove/ })).toBe(
			null,
		)
	},
})

export const MembersI2 = meta.story({
	args: membersArgs({ email: "sam@example.com" }),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I2. The field holds an address and has focus, wearing the input focus ring, and Invite is enabled. Check that Enter and Invite both report `onInvite` with the typed address.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const panel = await membersPanelIn()
		const field = inviteFieldIn(panel)
		const invite = within(panel).getByRole("button", { name: "Invite" })
		await expect(invite).toBeEnabled()

		await userEvent.click(invite)
		await expect(MEMBERS_PANEL.onInvite).toHaveBeenLastCalledWith(
			"sam@example.com",
		)
		await userEvent.type(field, "{Enter}")
		await expect(MEMBERS_PANEL.onInvite).toHaveBeenCalledTimes(2)
		await expect(MEMBERS_PANEL.onInvite).toHaveBeenLastCalledWith(
			"sam@example.com",
		)
		await expect(field).toHaveFocus()
	},
})

export const MembersI3 = meta.story({
	args: membersArgs({ members: [STEVE, SAM_PENDING] }),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I3. Sam was invited: the field is empty again and Sam joins the list as Pending, a dashed avatar with the mail glyph and the address alone on the name line.",
			},
		},
	},
	play: async () => {
		const panel = await membersPanelIn()
		await expect(memberRowsIn(panel)).toEqual([
			["S", "Steve", "steve@example.com", "Host"],
			["sam@example.com", "Pending", "Remove"],
		])
		const pending = slotsIn(panel, "space-member").at(-1)
		await expect(pending && glyphIn(pending, Icons.Mail)).not.toBe(null)
	},
})

export const MembersI4 = meta.story({
	args: membersArgs({ members: [STEVE, SAM_CARTER] }),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I4. Sam accepted: the row shows the name over the address, a one-letter avatar and the Joined tag, lined up with Host above it.",
			},
		},
	},
	play: async () => {
		const panel = await membersPanelIn()
		await expect(memberRowsIn(panel)).toEqual([
			["S", "Steve", "steve@example.com", "Host"],
			["S", "Sam Carter", "sam@example.com", "Joined", "Remove"],
		])
		const [host, joined] = slotsIn(panel, "space-member")
		await expect(
			within(host).getByText("Host").getBoundingClientRect().right,
		).toBe(within(joined).getByText("Joined").getBoundingClientRect().right)
		await expect(
			within(joined).getByRole("button", { name: "Remove Sam Carter" }),
		).toHaveTextContent("Remove")
	},
})

export const MembersWithdrawPending = meta.story({
	tags: ["test-only"],
	args: membersArgs({ members: [STEVE, SAM_PENDING] }),
	play: async ({ userEvent }) => {
		const panel = await membersPanelIn()
		const remove = within(panel).getByRole("button", {
			name: "Remove sam@example.com",
		})
		await userEvent.click(remove)
		await expect(MEMBERS_PANEL.onWithdraw).toHaveBeenCalledOnce()
		await expect(MEMBERS_PANEL.onWithdraw).toHaveBeenCalledWith(SAM_PENDING)
		await expect(MEMBERS_PANEL.onRemove).not.toHaveBeenCalled()
		await expect(screen.queryByRole("alertdialog")).toBe(null)
	},
})

const WithdrawnNotice = () => {
	const { t } = useTranslation("settings")

	useEffect(() => {
		const notice = raiseTransientNotice({
			title: t("space.members.withdrawn", { email: SAM_PENDING.email }),
		})
		return () => endNotice(notice)
	}, [t])

	return null
}

export const MembersI5 = meta.story({
	args: membersArgs(),
	decorators: [
		(Story) => (
			<>
				<Story />
				<NoticeSurface transientDelay={0} />
				<WithdrawnNotice />
			</>
		),
	],
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I5. Sam's invitation is withdrawn: the list is back to I1 and a success notice names the address. The app raises it with `raiseTransientNotice` and the catalogue's `space.members.withdrawn` copy; the story holds it open.",
			},
		},
	},
	play: async () => {
		const panel = await membersPanelIn()
		await expect(memberRowsIn(panel)).toHaveLength(1)
		const title = await waitFor(() => slotIn(document.body, "toast-title"))
		await expect(title).toHaveTextContent(
			"Invitation to sam@example.com withdrawn",
		)
	},
})

export const MembersI6 = meta.story({
	args: membersArgs({
		members: [STEVE, SAM_CARTER],
		removing: SAM_CARTER,
	}),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I6. Remove on a Joined row asks first, naming the member and the space, with Remove in the destructive style. The app opens the question by passing the member as `removing`; Cancel reports `onRemoveCancel` and Remove `onRemoveConfirm`.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const popup = await hostingQuestion("Remove Sam from Personal?")
		await expect(popup).toHaveTextContent(
			"Sam loses access right away. You can invite Sam again.",
		)
		await expect(
			within(popup)
				.getAllByRole("button")
				.map((button) => button.textContent),
		).toEqual(["Cancel", "Remove"])
		const remove = within(popup).getByRole("button", { name: "Remove" })
		await expect(getComputedStyle(remove).color).toBe(
			probedStyleOf("text-destructive", "color", popup),
		)
		await userEvent.click(remove)
		await expect(MEMBERS_PANEL.onRemoveConfirm).toHaveBeenCalledOnce()
		await expect(MEMBERS_PANEL.onRemoveCancel).not.toHaveBeenCalled()

		await userEvent.click(within(popup).getByRole("button", { name: "Cancel" }))
		await expect(MEMBERS_PANEL.onRemoveCancel).toHaveBeenCalledOnce()
		await expect(MEMBERS_PANEL.onRemoveConfirm).toHaveBeenCalledOnce()
	},
})

export const MembersI7 = meta.story({
	args: membersArgs({
		members: [STEVE, SAM_PENDING],
		email: "sam@example.com",
		refusal: "invited",
	}),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I7. The address is already invited: the field turns destructive, border and ring, and the helper becomes the refusal, read as the field's description.",
			},
		},
	},
	play: async () => {
		await expectRefusal(
			await membersPanelIn(),
			"sam@example.com is already invited.",
		)
	},
})

export const MembersI8 = meta.story({
	args: membersArgs({
		members: [STEVE, SAM_PENDING],
		email: "steve@example.com",
		refusal: "self",
	}),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I8. The reader typed their own address: same destructive field, the refusal says it is their own account.",
			},
		},
	},
	play: async () => {
		await expectRefusal(await membersPanelIn(), "That’s your own account.")
	},
})

export const MembersI9 = meta.story({
	args: membersArgs({
		members: [STEVE, SAM_PENDING],
		email: "sam",
		refusal: "malformed",
	}),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I9. The text is not an address: same destructive field, the refusal shows the expected shape.",
			},
		},
	},
	play: async () => {
		await expectRefusal(
			await membersPanelIn(),
			"Enter an email address, like sam@example.com.",
		)
	},
})

export const MembersI10 = meta.story({
	args: membersArgs({ isHosted: false }),
	parameters: {
		docs: {
			description: {
				story:
					"Artboard I10. The space is not hosted, so nobody off the network can be invited: the field gives way to a notice and an Open Hosting button reporting `onOpenHosting`. The member list and the share link stay.",
			},
		},
	},
	play: async ({ userEvent }) => {
		const panel = await membersPanelIn()
		await expect(
			within(panel).queryByRole("textbox", { name: "Invite people" }),
		).toBe(null)
		await expect(panel).toHaveTextContent(
			"Turn on hosting to invite people who aren’t on your network.",
		)
		await expect(memberRowsIn(panel)).toHaveLength(1)
		await expect(slotIn(panel, "share-link")).toBeVisible()

		await userEvent.click(
			within(panel).getByRole("button", { name: "Open Hosting" }),
		)
		await expect(MEMBERS_PANEL.onOpenHosting).toHaveBeenCalledOnce()
	},
})

const LONG_NAME = "Maximiliana Konstantinopoulou-Vanderberghe de la Fontaine"

export const MembersLongIdentity = meta.story({
	tags: ["test-only"],
	args: membersArgs({
		members: [
			STEVE,
			{
				id: "long",
				name: LONG_NAME,
				email:
					"maximiliana.konstantinopoulou-vanderberghe@example-long-domain.com",
				status: "joined",
			},
			{
				id: "long-pending",
				email:
					"maximiliana.konstantinopoulou-vanderberghe@example-long-domain.com",
				status: "pending",
			},
		],
	}),
	play: async () => {
		const panel = await membersPanelIn()
		const list = within(panel).getByRole("list")
		for (const remove of within(list).getAllByRole("button")) {
			await expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(
				list.getBoundingClientRect().right,
			)
		}
		const name = within(panel).getByText(LONG_NAME)
		await expect(name.getBoundingClientRect().height).toBe(20)
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
	},
})
