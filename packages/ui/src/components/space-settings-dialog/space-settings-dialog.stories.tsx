import { useState } from "react"
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
	shareLink: SHARE_LINK,
	onShareLinkCopy: fn(),
	onExport: fn(),
	onImport: fn(),
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
					"The space tab of a space joined from another Kiroshi, artboard J10. It lives on the host, so its name and the host it lives on are read-only here, the host carrying why. It has no colour, no share link and nothing to export or import, even when the app passes them. The rail is the local one, entry for entry. Pick `JoinedDanger` for the way out, `JoinedThemes` for both panels in light and dark.",
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
		await expect(args.onDelete).not.toHaveBeenCalled()
	},
})

const JoinedPanels = () => {
	const { t } = useTranslation("common")

	return (
		<div className="flex flex-col gap-5">
			<JoinedSpaceFields host={JOINED_HOST} name={JOINED_SPACE.name} />
			<DangerZone
				confirmTitle={t("spaces.leave.title", { name: JOINED_SPACE.name })}
				deleteLabel={t("spaces.leave.action")}
				description={t("spaces.leave.description")}
				icon="Leave"
				onDelete={fn()}
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
