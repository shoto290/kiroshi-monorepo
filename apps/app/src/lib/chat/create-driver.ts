import type { ChatDriver } from "./driver"
import { createFakeChatDriver } from "./fake-driver"

import { isDesktopHost } from "../host"
import { agentTransport } from "../agent/transport"
import { withFakeHostWrites } from "../conversations/fake-host-writes"
import type { TranscriptStore } from "../conversations/store-port"

export function createChatDriver(store: TranscriptStore): ChatDriver {
	return isDesktopHost()
		? agentTransport
		: withFakeHostWrites(createFakeChatDriver(), store)
}
