import { drivesRealHost, invoke } from "../host"
import type { OfferedModel_Serialize } from "@/lib/bindings"

export const readModelCatalogue = async (): Promise<string[]> => {
	if (!drivesRealHost()) return []
	const offered = await invoke<OfferedModel_Serialize[]>("agent_models")
	return offered.map((model) => model.value)
}
