import { invoke, isDesktopHost } from "../host"

export const readModelCatalogue = (): Promise<string[]> =>
	isDesktopHost() ? invoke<string[]>("agent_models") : Promise.resolve([])
