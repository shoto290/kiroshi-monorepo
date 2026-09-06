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

const namedMark = (
	table: Record<string, MissionMark>,
	name: string,
): MissionMark | undefined => {
	const key = markKeyOf(name)
	return Object.hasOwn(table, key) ? table[key] : undefined
}

type MissionTicketPlatform = {
	Mark: MissionMark
	isNamed: boolean
}

const missionToolMark = (tool: string): MissionMark =>
	namedMark(MISSION_TOOL_MARK, tool) ?? Icons.Tool

const missionTicketPlatform = (platform: string): MissionTicketPlatform => {
	const mark = namedMark(MISSION_TICKET_PLATFORM_MARK, platform)
	return { Mark: mark ?? Icons.Bookmark, isNamed: mark !== undefined }
}

const missionTicketPlatformMark = (platform: string): MissionMark =>
	missionTicketPlatform(platform).Mark

export {
	type MissionTicketPlatform,
	missionTicketPlatform,
	missionTicketPlatformMark,
	missionToolMark,
}
