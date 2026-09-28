import type { TriggerSource } from "./trigger-contract"

import { invoke } from "../host"

export const triggerSourcesTransport = {
	sources: (botId: string) =>
		invoke<TriggerSource[]>("routine_trigger_sources", { botId }),
}
