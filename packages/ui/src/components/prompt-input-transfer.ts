"use client"

import { type ClipboardEvent, type DragEvent, useState } from "react"

const FILES = "Files"

const filesIn = (transfer: DataTransfer) => Array.from(transfer.files)

const pastedFiles = (transfer: DataTransfer) =>
	transfer.types.every((type) => type === FILES) ? filesIn(transfer) : []

type PromptTransfer = {
	canAttach: boolean
	onAttach?: (files: File[]) => void
	onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void
}

const usePromptTransfer = ({
	canAttach,
	onAttach,
	onPaste,
}: PromptTransfer) => {
	const [isDragOver, setIsDragOver] = useState(false)

	const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
		if (!canAttach || !event.dataTransfer.types.includes(FILES)) return
		event.preventDefault()
		setIsDragOver(true)
	}

	const handleDragLeave = (event: DragEvent<HTMLFormElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
		setIsDragOver(false)
	}

	const handleDragEnd = () => setIsDragOver(false)

	const handleDrop = (event: DragEvent<HTMLFormElement>) => {
		setIsDragOver(false)
		const files = filesIn(event.dataTransfer)
		if (!canAttach || files.length === 0) return
		event.preventDefault()
		onAttach?.(files)
	}

	const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
		onPaste?.(event)
		if (!canAttach || event.defaultPrevented) return
		const files = pastedFiles(event.clipboardData)
		if (files.length === 0) return
		event.preventDefault()
		onAttach?.(files)
	}

	return {
		isDragOver,
		handleDragOver,
		handleDragLeave,
		handleDragEnd,
		handleDrop,
		handlePaste,
	}
}

export { usePromptTransfer }
