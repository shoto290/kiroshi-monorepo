import type { ComponentType } from "react"

import { type IconProps, Icons } from "@workspace/ui/components/icons"

type MissionMark = ComponentType<IconProps>

const MISSION_TOOL_MARK: Record<string, MissionMark> = {
	github: Icons.GitHub,
	paper: Icons.Paper,
	superset: Icons.Superset,
}

const MISSION_TICKET_PLATFORM_MARK: Record<string, MissionMark> = {
	github: Icons.GitHub,
	linear: Icons.Linear,
}

const markKeyOf = (name: string) => name.trim().toLowerCase()

const missionToolMark = (tool: string): MissionMark =>
	MISSION_TOOL_MARK[markKeyOf(tool)] ?? Icons.Tool

const missionTicketPlatformMark = (platform: string): MissionMark =>
	MISSION_TICKET_PLATFORM_MARK[markKeyOf(platform)] ?? Icons.Tool

export { missionTicketPlatformMark, missionToolMark }
