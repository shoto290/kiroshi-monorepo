import type { ChatDriver } from "./driver"
import { createFakeChatDriver } from "./fake-driver"

import { drivesRealHost } from "../host"
import { agentTransport } from "../agent/transport"
import { withFakeHostWrites } from "../conversations/fake-host-writes"
import type { TranscriptStore } from "../conversations/store-port"

export function createChatDriver(store: TranscriptStore): ChatDriver {
	return drivesRealHost()
		? agentTransport
		: withFakeHostWrites(createFakeChatDriver(), store)
}
