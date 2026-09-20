export type { AttachmentStoreError } from "@/lib/bindings"

export type SubmittedAttachment = {
	name: string
	bytes: Uint8Array
}

export type AttachmentsOwner =
	| { kind: "bot"; id: string }
	| { kind: "conversation"; id: string }
