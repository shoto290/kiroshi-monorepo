import { expect, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { Button } from "@workspace/ui/components/ui/button"
import { createToastManager, Toaster } from "@workspace/ui/components/ui/toast"

const manager = createToastManager()

const LONG_DESCRIPTION =
	"The scheduled routine watcher could not read the watched directory, so nothing ran on this tick and the next tick will retry from the same cursor."

type RaiseProps = {
	title: string
	description?: string
	type?: string
}

const Raise = ({ title, description, type }: RaiseProps) => (
	<Toaster toastManager={manager}>
		<Button
			onClick={() => manager.add({ title, description, type, timeout: 0 })}
			variant="outline"
		>
			Raise
		</Button>
	</Toaster>
)

const meta = preview.meta({
	title: "Feedback/Toast",
	component: Toaster,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The transient report as the shadcn registry ships it: `Toaster` is provider, portal, viewport and list in one, driven by a manager rather than by props. Its close control carries the registry's hardcoded English, so reach for `Overlays/NoticeSurface` whenever the copy has to come from the catalogue.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => (
		<Raise description="It runs every day at 09:00." title="Routine saved" />
	),
	parameters: {
		docs: {
			description: {
				story:
					"One notice raised from a press. Check it lands in the bottom corner over whatever is under it, and that it stays until it is dismissed - the story pins `timeout: 0` so the surface can be reviewed.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)

		await userEvent.click(canvas.getByRole("button", { name: "Raise" }))
		await waitFor(async () => {
			await expect(await body.findByText("Routine saved")).toBeVisible()
		})
	},
})

export const States = meta.story({
	render: () => (
		<Raise description="It runs every day at 09:00." title="Routine saved" />
	),
	parameters: {
		docs: {
			description: {
				story:
					"The raised notice and its close control. Check that pressing the control removes the notice. The registry close reaches the DOM with no accessible name, which is the reason `Overlays/NoticeSurface` supplies its own through the render prop - do not read this story as a naming reference.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)

		await userEvent.click(canvas.getByRole("button", { name: "Raise" }))
		await expect(await body.findByText("Routine saved")).toBeVisible()

		const [close] = slotsIn(canvasElement.ownerDocument.body, "toast-close")

		await userEvent.click(close)
		await waitFor(async () => {
			await expect(body.queryByText("Routine saved")).not.toBeInTheDocument()
		})
	},
})

export const LongContent = meta.story({
	render: () => (
		<Raise
			description={LONG_DESCRIPTION}
			title="ScheduledRoutineWatcherCouldNotReadTheWatchedDirectory"
			type="error"
		/>
	),
	parameters: {
		docs: {
			description: {
				story:
					"An unbreakable title and a description of several sentences, the shape a raw error identifier takes. Check the title breaks inside the word instead of widening the notice, and that the notice keeps its cap against the viewport.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)

		await userEvent.click(canvas.getByRole("button", { name: "Raise" }))

		const notice = await body.findByText(LONG_DESCRIPTION)
		await expect(notice.getBoundingClientRect().right).toBeLessThanOrEqual(
			window.innerWidth,
		)
	},
})
