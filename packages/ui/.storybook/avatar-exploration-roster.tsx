import { type ComponentType, useId, useState } from "react"
import { expect, userEvent, within } from "storybook/test"

import {
	EXPLORATION_STATES,
	type ExplorationAvatarProps,
	type ExplorationState,
} from "@workspace/ui/components/avatar-exploration"
import {
	RadioGroup,
	RadioGroupItem,
} from "@workspace/ui/components/ui/radio-group"

type RosterChoice = "mixed" | ExplorationState

type ExplorationRosterProps = {
	Avatar: ComponentType<ExplorationAvatarProps>
}

type RosterPlay = { canvasElement: HTMLElement }

type RosterCompanion = Required<Omit<ExplorationAvatarProps, "size">>

const ROSTER: RosterCompanion[] = [
	{ name: "Lyra", tint: "blue", state: "idle" },
	{ name: "Orion", tint: "blue", state: "thinking" },
	{ name: "Vega", tint: "orange", state: "idle" },
	{ name: "Atlas", tint: "green", state: "searching" },
	{ name: "Nova", tint: "purple", state: "idle" },
	{ name: "Sirius", tint: "pink", state: "writing" },
]

const CHOICES: RosterChoice[] = ["mixed", ...EXPLORATION_STATES]

const LADDER = [16, 40, 96]

const SWITCHED_STATE: ExplorationState = "working"

export const ExplorationRoster = ({ Avatar }: ExplorationRosterProps) => {
	const [choice, setChoice] = useState<RosterChoice>("mixed")
	const group = useId()
	const stateOf = (state: ExplorationState) =>
		choice === "mixed" ? state : choice
	const [featured] = ROSTER

	return (
		<div className="flex flex-col gap-8 text-foreground text-sm">
			<RadioGroup
				aria-label="State"
				className="flex flex-wrap gap-4"
				onValueChange={(value) => setChoice(value as RosterChoice)}
				value={choice}
			>
				{CHOICES.map((option) => (
					<label
						className="flex items-center gap-2"
						htmlFor={`${group}-${option}`}
						key={option}
					>
						<RadioGroupItem id={`${group}-${option}`} value={option} />
						{option}
					</label>
				))}
			</RadioGroup>
			<fieldset aria-label="Roster" className="flex gap-4">
				{ROSTER.map((companion) => (
					<div
						className="flex flex-col items-center gap-2"
						key={companion.name}
					>
						<Avatar
							name={companion.name}
							size={40}
							state={stateOf(companion.state)}
							tint={companion.tint}
						/>
						<span className="text-muted-foreground text-xs">
							{companion.name}
						</span>
					</div>
				))}
			</fieldset>
			<fieldset aria-label="Sizes" className="flex items-end gap-4">
				{LADDER.map((size) => (
					<Avatar
						key={size}
						name={featured.name}
						size={size}
						state={stateOf(featured.state)}
						tint={featured.tint}
					/>
				))}
			</fieldset>
		</div>
	)
}

const statesIn = (roster: HTMLElement) =>
	within(roster)
		.getAllByRole("img")
		.map((avatar) => avatar.dataset.state)

export const playExplorationRoster = async ({ canvasElement }: RosterPlay) => {
	const canvas = within(canvasElement)
	const controls = canvas.getAllByRole("radiogroup", { name: "State" })
	const rosters = canvas.getAllByRole("group", { name: "Roster" })

	await expect(rosters.length).toBeGreaterThan(0)
	await expect(rosters).toHaveLength(controls.length)

	for (const [index, roster] of rosters.entries()) {
		await expect(within(roster).getAllByRole("img")).toHaveLength(ROSTER.length)
		for (const { name } of ROSTER)
			await expect(within(roster).getByRole("img", { name })).toBeVisible()
		await expect(new Set(statesIn(roster)).size).toBe(4)

		await userEvent.click(
			within(controls[index]).getByRole("radio", { name: SWITCHED_STATE }),
		)
		await expect(statesIn(roster)).toEqual(ROSTER.map(() => SWITCHED_STATE))
	}
}
