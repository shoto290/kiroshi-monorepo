import type { SubmittedAttachment as SubmittedAttachmentBinding } from "@/lib/bindings"

export type { AttachmentStoreError } from "@/lib/bindings"

export type SubmittedAttachment = Omit<SubmittedAttachmentBinding, "bytes"> & {
	bytes: Uint8Array
}

export type AttachmentsOwner =
	| { kind: "bot"; id: string }
	| { kind: "conversation"; id: string }
