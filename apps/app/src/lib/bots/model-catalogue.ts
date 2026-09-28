import { drivesRealHost, invoke } from "../host"

export const readModelCatalogue = (): Promise<string[]> =>
	drivesRealHost() ? invoke<string[]>("agent_models") : Promise.resolve([])
