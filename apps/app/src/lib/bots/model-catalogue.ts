import { drivesRealHost, invoke } from "../host"
import type { OfferedModel_Serialize } from "@/lib/bindings"

export const readModelCatalogue = async (): Promise<
	OfferedModel_Serialize[]
> => {
	if (!drivesRealHost()) return []
	return invoke<OfferedModel_Serialize[]>("agent_models")
}
