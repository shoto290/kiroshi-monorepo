import type {
	ApplicationRow_Serialize,
	Disconnected_Serialize,
} from "@/lib/bindings"
import type { EnvOwner } from "../conversations/store-contract"

export type {
	ApplicationRow_Serialize as ApplicationRow,
	Disconnected_Serialize as Disconnected,
} from "@/lib/bindings"

export type ConnectionPort = {
	connect: (owner: EnvOwner, name: string, url: string) => Promise<void>
	cancel: () => Promise<void>
	disconnect: (
		owner: EnvOwner,
		name: string,
		url: string,
	) => Promise<Disconnected_Serialize>
	status: (owner: EnvOwner) => Promise<ApplicationRow_Serialize[]>
}
