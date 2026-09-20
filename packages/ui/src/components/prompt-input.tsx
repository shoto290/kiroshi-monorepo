"use client"

import {
	type FormEvent,
	type ReactNode,
	type Ref,
	type TextareaHTMLAttributes,
	useMemo,
	useState,
} from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { PromptField } from "@workspace/ui/components/prompt-input-field"
import { usePromptLayout } from "@workspace/ui/components/prompt-input-layout"
import { usePromptTransfer } from "@workspace/ui/components/prompt-input-transfer"
import { Button } from "@workspace/ui/components/ui/button"
import { cn, mergeRefs } from "@workspace/ui/lib/utils"

export interface PromptInputProps
	extends Omit<
		TextareaHTMLAttributes<HTMLTextAreaElement>,
		"value" | "defaultValue" | "onChange" | "onSubmit" | "children"
	> {
	value?: string
	defaultValue?: string
	onValueChange?: (value: string) => void
	onSubmit?: (value: string) => void
	leading?: ReactNode
	attachments?: ReactNode
	onAttach?: (files: File[]) => void
	dropTarget?: boolean
	textareaRef?: Ref<HTMLTextAreaElement>
}

export function PromptInput({
	value,
	defaultValue = "",
	onValueChange,
	onSubmit,
	leading,
	attachments,
	onAttach,
	dropTarget = false,
	className,
	disabled,
	placeholder,
	"aria-label": ariaLabel,
	onKeyDown,
	onPaste,
	textareaRef: externalTextareaRef,
	...textareaProps
}: PromptInputProps) {
	const { t } = useTranslation("chat")
	const [internalValue, setInternalValue] = useState(defaultValue)
	const currentValue = value ?? internalValue
	const canAttach = Boolean(onAttach) && !disabled

	const { refs, isExpanded, hasAttachments } = usePromptLayout({
		attachments,
		currentValue,
	})
	const {
		isDragOver,
		handleDragOver,
		handleDragLeave,
		handleDragEnd,
		handleDrop,
		handlePaste,
	} = usePromptTransfer({ canAttach, onAttach, onPaste })
	const setTextareaRef = useMemo(
		() => mergeRefs(refs.textarea, externalTextareaRef),
		[refs.textarea, externalTextareaRef],
	)

	const hasPayload = Boolean(currentValue.trim()) || hasAttachments
	const isDropTarget = canAttach && (dropTarget || isDragOver)
	const canSubmit = hasPayload && !disabled

	const setValue = (next: string) => {
		if (value === undefined) setInternalValue(next)
		onValueChange?.(next)
	}

	const submit = (event?: FormEvent) => {
		event?.preventDefault()
		if (!canSubmit) return

		onSubmit?.(currentValue.trim())
		if (value === undefined) setInternalValue("")
		refs.textarea.current?.focus({ preventScroll: true })
	}

	return (
		<form
			ref={refs.form}
			onSubmit={submit}
			data-slot="prompt-input"
			data-expanded={isExpanded}
			data-drop-target={isDropTarget}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDragEnd={handleDragEnd}
			onDrop={handleDrop}
			className={cn(
				"flex w-full flex-wrap items-center gap-1 rounded-4xl border border-border bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
				isDropTarget && "border-primary bg-primary/10",
				disabled && "opacity-50",
				className,
			)}
		>
			<div
				ref={refs.attachments}
				inert={disabled}
				className="w-full empty:hidden"
			>
				{attachments}
			</div>

			<PromptField
				disabled={disabled}
				label={ariaLabel}
				onKeyDown={onKeyDown}
				onPaste={handlePaste}
				onSubmit={submit}
				onValueChange={setValue}
				placeholder={placeholder}
				refs={refs}
				textareaProps={textareaProps}
				textareaRef={setTextareaRef}
				value={currentValue}
			/>

			<div
				ref={refs.leading}
				inert={disabled}
				className={cn(
					"flex items-center gap-1 empty:hidden",
					!isExpanded && "order-first",
				)}
			>
				{leading}
			</div>

			<div
				ref={refs.controls}
				inert={disabled}
				className="ms-auto flex items-center"
			>
				{hasPayload ? (
					<Button
						type="submit"
						size="icon"
						disabled={!canSubmit}
						aria-label={t("composer.send")}
						className="rounded-full"
					>
						<Icons.Send />
					</Button>
				) : null}
			</div>
		</form>
	)
}
