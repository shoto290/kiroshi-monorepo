import type { BotChangedFile } from "../conversations/store-contract"

export const joinedPatches = (files: BotChangedFile[]) =>
	files.map((file) => file.patch).join("")
